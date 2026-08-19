from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
from pydantic import BaseModel

# Gestação média do bovino (dias). Usada pra estimar a previsão de parto da cobertura natural.
GESTACAO_DIAS = 285
from ..database import get_db
from ..models.reproducao import Reproducao
from ..models.animal import Animal, CategoriaAnimalEnum
from ..schemas.reproducao import ReproducaoCreate, ReproducaoLoteCreate, ReproducaoUpdate, ReproducaoOut, TipoReproducaoEnum
from ..auth import get_current_user, check_assinatura_ativa
from ..models.user import User

router = APIRouter()


class BulkDeleteIn(BaseModel):
    ids: List[int]


class BulkResult(BaseModel):
    total: int
    afetados: int


def _houve_nascimento(tipo, resultado) -> bool:
    """True quando o evento representa um nascimento (nasceu bezerro, ou parto não-aborto)."""
    return resultado == "nasceu bezerro" or (tipo == TipoReproducaoEnum.parto and resultado != "aborto")


def _criar_bezerro(db, uid, mae, *, brinco, sexo, peso, data_nascimento):
    """Cria o animal bezerro filho de `mae`. Valida brinco duplicado."""
    if brinco:
        existe = db.query(Animal).filter(
            Animal.user_id == uid,
            Animal.brinco == brinco,
            Animal.deletado_em.is_(None),
        ).first()
        if existe:
            raise HTTPException(
                status_code=400,
                detail=f"Brinco '{brinco}' ja cadastrado em outro animal",
            )
    db.add(Animal(
        user_id=uid,
        brinco=brinco,
        sexo=sexo or "femea",
        categoria=CategoriaAnimalEnum.bezerro,
        data_nascimento=data_nascimento,
        peso_entrada=peso,
        lote_id=mae.lote_id,
        origem=(f"Filho(a) de #{mae.brinco}" if mae.brinco else "Nascido na fazenda"),
    ))


@router.get("", response_model=List[ReproducaoOut])
def listar_reproducao(
    animal_id: Optional[int] = Query(None),
    lote_id: Optional[int] = Query(None),
    tipo: Optional[str] = Query(None),
    partos_esperados: Optional[bool] = Query(None, description="Partos previstos a partir de hoje"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Reproducao).join(Animal).filter(
        Animal.user_id == current_user.id,
        Animal.deletado_em.is_(None),
    )
    if animal_id:
        q = q.filter(Reproducao.animal_id == animal_id)
    if lote_id:
        q = q.filter(Animal.lote_id == lote_id)
    if tipo:
        q = q.filter(Reproducao.tipo == tipo)
    if partos_esperados:
        q = q.filter(Reproducao.data_prevista_parto >= date.today())
    return q.order_by(Reproducao.data.desc()).all()


@router.post("", response_model=ReproducaoOut, status_code=201)
def criar_reproducao(data: ReproducaoCreate, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    animal = db.query(Animal).filter(Animal.id == data.animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")

    # Campos transientes do bezerro nao pertencem ao model Reproducao
    payload = data.model_dump()
    bezerro_sexo = payload.pop('bezerro_sexo', None)
    bezerro_peso_kg = payload.pop('bezerro_peso_kg', None)

    # Cobertura natural sem previsão informada: estima o parto mais cedo possível
    # (início + gestação). O período de cobertura vira uma janela de partos no app.
    if data.tipo == TipoReproducaoEnum.cobertura_natural and payload.get('data_prevista_parto') is None:
        payload['data_prevista_parto'] = data.data + timedelta(days=GESTACAO_DIAS)

    repro = Reproducao(**payload, user_id=current_user.id)
    db.add(repro)

    # Cria automaticamente um animal "bezerro" quando o evento é um parto ou houve nascimento
    if _houve_nascimento(data.tipo, data.resultado):
        _criar_bezerro(
            db, current_user.id, animal,
            brinco=data.bezerro_brinco, sexo=bezerro_sexo,
            peso=bezerro_peso_kg, data_nascimento=data.data,
        )

    db.commit()
    db.refresh(repro)
    return repro


@router.post("/lote", response_model=BulkResult, status_code=201)
def criar_reproducao_lote(
    data: ReproducaoLoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    """IATF / estação de monta: cria o mesmo evento para todas as fêmeas ativas do lote.
    Não cria bezerros automaticamente (isso é lançamento individual)."""
    femeas = db.query(Animal).filter(
        Animal.user_id == current_user.id,
        Animal.lote_id == data.lote_id,
        Animal.sexo == "femea",
        Animal.status == "ativo",
        Animal.deletado_em.is_(None),
    ).all()
    if not femeas:
        raise HTTPException(status_code=400, detail="Nenhuma fêmea ativa nesse lote")

    # Cobertura natural sem previsão informada: estima o parto mais cedo possível
    previsao = data.data_prevista_parto
    if previsao is None and data.tipo == TipoReproducaoEnum.cobertura_natural:
        previsao = data.data + timedelta(days=GESTACAO_DIAS)

    for a in femeas:
        db.add(Reproducao(
            user_id=current_user.id,
            animal_id=a.id,
            tipo=data.tipo,
            data=data.data,
            data_fim=data.data_fim,
            touro_brinco=data.touro_brinco,
            resultado=data.resultado,
            data_prevista_parto=previsao,
            observacoes=data.observacoes,
        ))
    db.commit()
    return BulkResult(total=len(femeas), afetados=len(femeas))


@router.get("/{repro_id}", response_model=ReproducaoOut)
def get_reproducao(repro_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    repro = db.query(Reproducao).join(Animal).filter(Reproducao.id == repro_id, Animal.user_id == current_user.id).first()
    if not repro:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    return repro


@router.put("/{repro_id}", response_model=ReproducaoOut)
def atualizar_reproducao(repro_id: int, data: ReproducaoUpdate, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    repro = db.query(Reproducao).join(Animal).filter(Reproducao.id == repro_id, Animal.user_id == current_user.id).first()
    if not repro:
        raise HTTPException(status_code=404, detail="Registro não encontrado")

    # Estado de nascimento ANTES da edição — pra criar o bezerro só na transição
    # (evita duplicar o bezerro se o registro já era "nasceu bezerro" e você edita de novo).
    nascido_antes = _houve_nascimento(repro.tipo, repro.resultado)

    payload = data.model_dump(exclude_unset=True)
    # Campos transientes do bezerro não pertencem ao model Reproducao
    bezerro_sexo = payload.pop('bezerro_sexo', None)
    bezerro_peso_kg = payload.pop('bezerro_peso_kg', None)
    bezerro_data_nasc = payload.pop('bezerro_data_nascimento', None)

    for field, value in payload.items():
        setattr(repro, field, value)

    # Passou a representar um nascimento agora (e não era antes) → cria o bezerro
    if _houve_nascimento(repro.tipo, repro.resultado) and not nascido_antes:
        data_nasc = bezerro_data_nasc or repro.data_prevista_parto or repro.data
        _criar_bezerro(
            db, current_user.id, repro.animal,
            brinco=repro.bezerro_brinco, sexo=bezerro_sexo,
            peso=bezerro_peso_kg, data_nascimento=data_nasc,
        )

    db.commit()
    db.refresh(repro)
    return repro


@router.post("/bulk-delete", response_model=BulkResult)
def bulk_delete_reproducao(
    data: BulkDeleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    if not data.ids:
        raise HTTPException(status_code=400, detail="Nenhum registro selecionado")
    registros = db.query(Reproducao).join(Animal).filter(
        Reproducao.id.in_(data.ids),
        Animal.user_id == current_user.id,
    ).all()
    for r in registros:
        db.delete(r)
    db.commit()
    return BulkResult(total=len(data.ids), afetados=len(registros))


@router.delete("/{repro_id}", status_code=204)
def deletar_reproducao(repro_id: int, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    repro = db.query(Reproducao).join(Animal).filter(Reproducao.id == repro_id, Animal.user_id == current_user.id).first()
    if not repro:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    db.delete(repro)
    db.commit()
