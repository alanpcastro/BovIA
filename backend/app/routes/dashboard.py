from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from ..database import get_db
from ..models.animal import Animal, StatusEnum
from ..models.saude import Saude
from ..models.reproducao import Reproducao
from ..models.pesagem import Pesagem
from ..models.movimentacao import Movimentacao
from ..models.lote import Lote
from ..models.pasto import Pasto, StatusPastoEnum
from ..models.animal import SexoEnum, CategoriaAnimalEnum
from ..models.movimentacao import TipoMovEnum
import random
from ..auth import get_current_user, check_assinatura_ativa
from ..models.user import User
from ..email_service import enviar_alerta_vacinacao

router = APIRouter()


@router.post("/demo")
def gerar_dados_demo(db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    uid = current_user.id
    
    # Verifica se ja tem dados
    if db.query(Animal).filter(Animal.user_id == uid).first():
        raise HTTPException(status_code=400, detail="Voce ja possui dados cadastrados. Limpe seus dados antes de gerar o demo.")

    hoje = date.today()
    
    # 1. Criar Pastos
    p1 = Pasto(user_id=uid, nome="Piquete 01", area_ha=15.0, capacidade_ua_ha=2.5, status=StatusPastoEnum.ocupado)
    p2 = Pasto(user_id=uid, nome="Piquete 02", area_ha=20.0, capacidade_ua_ha=2.5, status=StatusPastoEnum.descanso)
    db.add_all([p1, p2])
    db.flush()

    # 2. Criar Lotes
    l1 = Lote(user_id=uid, nome="Bezerros 2026", area_hectares=15.0, pasto_atual_id=p1.id, data_entrada=hoje - timedelta(days=60))
    l2 = Lote(user_id=uid, nome="Vacas Paridas", area_hectares=20.0, data_entrada=hoje - timedelta(days=30))
    db.add_all([l1, l2])
    db.flush()

    # 3. Criar Animais
    animais = []
    # Lote 1: 10 Bezerros
    for i in range(1, 11):
        data_nasc = hoje - timedelta(days=random.randint(200, 300))
        peso_ent = random.uniform(180, 220)
        a = Animal(
            user_id=uid, lote_id=l1.id, brinco=f"B-{i:03d}", sexo=SexoEnum.macho,
            categoria=CategoriaAnimalEnum.bezerro, data_nascimento=data_nasc,
            peso_entrada=peso_ent, origem="nascido", status=StatusEnum.ativo
        )
        animais.append(a)
        db.add(a)
    
    # Lote 2: 5 Vacas
    for i in range(1, 6):
        a = Animal(
            user_id=uid, lote_id=l2.id, brinco=f"V-{i:03d}", sexo=SexoEnum.femea,
            categoria=CategoriaAnimalEnum.vaca, status=StatusEnum.ativo,
            peso_entrada=450.0, origem="comprado"
        )
        animais.append(a)
        db.add(a)
    
    db.flush()

    # 4. Criar Pesagens e Movimentacoes
    for a in animais:
        # Pesagem inicial (ha 30 dias)
        p_ini = Pesagem(animal_id=a.id, user_id=uid, data=hoje - timedelta(days=30), peso_kg=a.peso_entrada + 5)
        # Pesagem atual
        p_fim = Pesagem(animal_id=a.id, user_id=uid, data=hoje, peso_kg=a.peso_entrada + 35)
        db.add_all([p_ini, p_fim])

        # Movimentacao de entrada
        mov = Movimentacao(
            user_id=uid, animal_id=a.id, tipo=TipoMovEnum.nascimento if a.origem == "nascido" else TipoMovEnum.compra,
            data=a.data_nascimento or (hoje - timedelta(days=100)),
            valor=0 if a.origem == "nascido" else 3500.0,
            peso_kg=a.peso_entrada
        )
        db.add(mov)

    db.commit()
    return {"message": "Dados de exemplo gerados com sucesso!", "animais": len(animais)}


@router.post("/limpar-demo")
def limpar_dados_demo(db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    uid = current_user.id
    
    # Deletar em ordem para evitar problemas de FK (embora tenhamos cascade em alguns)
    db.query(Movimentacao).filter(Movimentacao.user_id == uid).delete()
    db.query(Pesagem).filter(Pesagem.user_id == uid).delete()
    db.query(Saude).filter(Saude.user_id == uid).delete()
    db.query(Reproducao).filter(Reproducao.user_id == uid).delete()
    db.query(Animal).filter(Animal.user_id == uid).delete()
    db.query(Lote).filter(Lote.user_id == uid).delete()
    db.query(Pasto).filter(Pasto.user_id == uid).delete()
    
    db.commit()
    return {"message": "Todos os seus dados foram removidos com sucesso!"}


@router.get("")
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    uid = current_user.id
    hoje = date.today()
    proximos_30 = hoje + timedelta(days=30)

    total_animais = db.query(func.count(Animal.id)).filter(
        Animal.user_id == uid, Animal.status == StatusEnum.ativo, Animal.deletado_em == None  # noqa: E711
    ).scalar()

    total_machos = db.query(func.count(Animal.id)).filter(
        Animal.user_id == uid, Animal.status == StatusEnum.ativo, Animal.deletado_em == None, Animal.sexo == "macho"  # noqa: E711
    ).scalar()

    total_femeas = db.query(func.count(Animal.id)).filter(
        Animal.user_id == uid, Animal.status == StatusEnum.ativo, Animal.deletado_em == None, Animal.sexo == "femea"  # noqa: E711
    ).scalar()

    # Peso médio: última pesagem de cada animal ativo
    subq = (
        db.query(Pesagem.animal_id, func.max(Pesagem.data).label("ultima_data"))
        .join(Animal)
        .filter(Animal.user_id == uid, Animal.status == StatusEnum.ativo, Animal.deletado_em == None)  # noqa: E711
        .group_by(Pesagem.animal_id)
        .subquery()
    )
    ultimas = db.query(Pesagem).join(
        subq, (Pesagem.animal_id == subq.c.animal_id) & (Pesagem.data == subq.c.ultima_data)
    ).all()

    peso_medio = None
    if ultimas:
        peso_medio = round(sum(p.peso_kg for p in ultimas) / len(ultimas), 1)

    # Próximas vacinas (proxima_data nos próximos 30 dias)
    proximas_vacinas = db.query(Saude).join(Animal).filter(
        Animal.user_id == uid,
        Saude.proxima_data != None,
        Saude.proxima_data >= hoje,
        Saude.proxima_data <= proximos_30,
    ).order_by(Saude.proxima_data).limit(10).all()

    # Partos previstos nos próximos 60 dias
    proximos_60 = hoje + timedelta(days=60)
    partos_previstos = db.query(Reproducao).join(Animal).filter(
        Animal.user_id == uid,
        Reproducao.data_prevista_parto != None,
        Reproducao.data_prevista_parto >= hoje,
        Reproducao.data_prevista_parto <= proximos_60,
    ).order_by(Reproducao.data_prevista_parto).limit(10).all()

    proximas_vacinas_data = [
        {
            "id": s.id,
            "animal_id": s.animal_id,
            "brinco": s.animal.brinco if hasattr(s, 'animal') and s.animal else "",
            "nome": s.animal.nome if hasattr(s, 'animal') and s.animal else None,
            "descricao": s.descricao,
            "tipo": s.tipo,
            "proxima_data": str(s.proxima_data),
        }
        for s in proximas_vacinas
    ]

    return {
        "total_animais": total_animais,
        "total_machos": total_machos,
        "total_femeas": total_femeas,
        "peso_medio_kg": peso_medio,
        "proximas_vacinas": proximas_vacinas_data,
        "partos_previstos": [
            {
                "id": r.id,
                "animal_id": r.animal_id,
                "data_prevista_parto": r.data_prevista_parto,
                "touro_brinco": r.touro_brinco,
            }
            for r in partos_previstos
        ],
    }


@router.post("/alertas/email")
async def enviar_alertas_email(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    uid = current_user.id
    hoje = date.today()
    proximos_7 = hoje + timedelta(days=7)

    vacinas = db.query(Saude).join(Animal).filter(
        Animal.user_id == uid,
        Saude.proxima_data != None,
        Saude.proxima_data >= hoje,
        Saude.proxima_data <= proximos_7,
    ).order_by(Saude.proxima_data).all()

    if not vacinas:
        return {"message": "Nenhuma vacinação prevista nos próximos 7 dias"}

    alertas = [
        {
            "brinco": s.animal.brinco if s.animal else "",
            "nome": s.animal.nome if s.animal else None,
            "descricao": s.descricao,
            "proxima_data": str(s.proxima_data),
        }
        for s in vacinas
    ]

    background_tasks.add_task(
        enviar_alerta_vacinacao,
        current_user.email,
        current_user.fazenda_nome,
        alertas,
    )

    return {"message": f"Alerta enviado para {current_user.email} com {len(alertas)} vacinação(ões)"}
