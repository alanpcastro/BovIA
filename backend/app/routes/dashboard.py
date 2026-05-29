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
from ..auth import get_current_user
from ..models.user import User
from ..email_service import enviar_alerta_vacinacao

router = APIRouter()


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
    current_user: User = Depends(get_current_user),
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
