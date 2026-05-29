from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from pydantic import BaseModel
from ..database import get_db
from ..models.reproducao import Reproducao
from ..models.animal import Animal, CategoriaAnimalEnum
from ..schemas.reproducao import ReproducaoCreate, ReproducaoUpdate, ReproducaoOut, TipoReproducaoEnum
from ..auth import get_current_user
from ..models.user import User

router = APIRouter()


class BulkDeleteIn(BaseModel):
    ids: List[int]


class BulkResult(BaseModel):
    total: int
    afetados: int


@router.get("", response_model=List[ReproducaoOut])
def listar_reproducao(
    animal_id: Optional[int] = Query(None),
    tipo: Optional[str] = Query(None),
    partos_esperados: Optional[bool] = Query(None, description="Partos previstos a partir de hoje"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Reproducao).join(Animal).filter(Animal.user_id == current_user.id)
    if animal_id:
        q = q.filter(Reproducao.animal_id == animal_id)
    if tipo:
        q = q.filter(Reproducao.tipo == tipo)
    if partos_esperados:
        q = q.filter(Reproducao.data_prevista_parto >= date.today())
    return q.order_by(Reproducao.data.desc()).all()


@router.post("", response_model=ReproducaoOut, status_code=201)
def criar_reproducao(data: ReproducaoCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    animal = db.query(Animal).filter(Animal.id == data.animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")

    # Campos transientes do bezerro nao pertencem ao model Reproducao
    payload = data.model_dump()
    bezerro_sexo = payload.pop('bezerro_sexo', None)
    bezerro_peso_kg = payload.pop('bezerro_peso_kg', None)

    repro = Reproducao(**payload, user_id=current_user.id)
    db.add(repro)

    # Cria automaticamente um animal "bezerro" quando o evento e um parto ou houve nascimento
    deve_criar_bezerro = (
        data.resultado == "nasceu bezerro"
        or (data.tipo == TipoReproducaoEnum.parto and data.resultado != "aborto")
    )
    if deve_criar_bezerro:
        if data.bezerro_brinco:
            existe = db.query(Animal).filter(
                Animal.user_id == current_user.id,
                Animal.brinco == data.bezerro_brinco,
                Animal.deletado_em.is_(None),
            ).first()
            if existe:
                raise HTTPException(
                    status_code=400,
                    detail=f"Brinco '{data.bezerro_brinco}' ja cadastrado em outro animal",
                )
        bezerro = Animal(
            user_id=current_user.id,
            brinco=data.bezerro_brinco,
            sexo=bezerro_sexo or "femea",
            categoria=CategoriaAnimalEnum.bezerro,
            data_nascimento=data.data,
            peso_entrada=bezerro_peso_kg,
            lote_id=animal.lote_id,
            origem=(f"Filho(a) de #{animal.brinco}" if animal.brinco else "Nascido na fazenda"),
        )
        db.add(bezerro)

    db.commit()
    db.refresh(repro)
    return repro


@router.get("/{repro_id}", response_model=ReproducaoOut)
def get_reproducao(repro_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    repro = db.query(Reproducao).join(Animal).filter(Reproducao.id == repro_id, Animal.user_id == current_user.id).first()
    if not repro:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    return repro


@router.put("/{repro_id}", response_model=ReproducaoOut)
def atualizar_reproducao(repro_id: int, data: ReproducaoUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    repro = db.query(Reproducao).join(Animal).filter(Reproducao.id == repro_id, Animal.user_id == current_user.id).first()
    if not repro:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(repro, field, value)
    db.commit()
    db.refresh(repro)
    return repro


@router.post("/bulk-delete", response_model=BulkResult)
def bulk_delete_reproducao(
    data: BulkDeleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
def deletar_reproducao(repro_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    repro = db.query(Reproducao).join(Animal).filter(Reproducao.id == repro_id, Animal.user_id == current_user.id).first()
    if not repro:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    db.delete(repro)
    db.commit()
