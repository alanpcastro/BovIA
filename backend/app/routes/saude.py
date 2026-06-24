from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from pydantic import BaseModel
from ..database import get_db
from ..models.saude import Saude
from ..models.animal import Animal
from ..schemas.saude import SaudeCreate, SaudeUpdate, SaudeOut
from ..auth import get_current_user, check_assinatura_ativa
from ..models.user import User


class BulkDeleteIn(BaseModel):
    ids: List[int]


class BulkResult(BaseModel):
    total: int
    afetados: int


router = APIRouter()


@router.get("", response_model=List[SaudeOut])
def listar_saude(
    animal_id: Optional[int] = Query(None),
    tipo: Optional[str] = Query(None),
    vencendo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Saude).join(Animal).filter(
        Animal.user_id == current_user.id,
        Animal.deletado_em.is_(None),
    )
    if animal_id:
        q = q.filter(Saude.animal_id == animal_id)
    if tipo:
        q = q.filter(Saude.tipo == tipo)
    if vencendo:
        q = q.filter(Saude.proxima_data >= date.today())
    return q.order_by(Saude.data.desc()).all()


@router.post("", response_model=SaudeOut, status_code=201)
def criar_saude(data: SaudeCreate, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    animal = db.query(Animal).filter(Animal.id == data.animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")

    saude = Saude(**data.model_dump(), user_id=current_user.id)
    db.add(saude)
    db.commit()
    db.refresh(saude)
    return saude


@router.get("/{saude_id}", response_model=SaudeOut)
def get_saude(saude_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    saude = db.query(Saude).join(Animal).filter(Saude.id == saude_id, Animal.user_id == current_user.id).first()
    if not saude:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    return saude


@router.put("/{saude_id}", response_model=SaudeOut)
def atualizar_saude(saude_id: int, data: SaudeUpdate, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    saude = db.query(Saude).join(Animal).filter(Saude.id == saude_id, Animal.user_id == current_user.id).first()
    if not saude:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(saude, field, value)
    db.commit()
    db.refresh(saude)
    return saude


@router.post("/bulk-delete", response_model=BulkResult)
def bulk_delete_saude(
    data: BulkDeleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    if not data.ids:
        raise HTTPException(status_code=400, detail="Nenhum registro selecionado")
    registros = db.query(Saude).join(Animal).filter(
        Saude.id.in_(data.ids),
        Animal.user_id == current_user.id,
    ).all()
    for s in registros:
        db.delete(s)
    db.commit()
    return BulkResult(total=len(data.ids), afetados=len(registros))


@router.delete("/{saude_id}", status_code=204)
def deletar_saude(saude_id: int, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    saude = db.query(Saude).join(Animal).filter(Saude.id == saude_id, Animal.user_id == current_user.id).first()
    if not saude:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    db.delete(saude)
    db.commit()
