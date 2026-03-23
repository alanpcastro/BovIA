from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.lote import Lote
from ..models.animal import Animal
from ..schemas.lote import LoteCreate, LoteUpdate, LoteOut
from ..auth import get_current_user
from ..models.user import User

router = APIRouter()


@router.get("", response_model=List[LoteOut])
def listar_lotes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lotes = db.query(Lote).filter(Lote.user_id == current_user.id).all()
    result = []
    for lote in lotes:
        total = db.query(Animal).filter(Animal.lote_id == lote.id, Animal.status == "ativo").count()
        out = LoteOut.model_validate(lote)
        out.total_animais = total
        result.append(out)
    return result


@router.post("", response_model=LoteOut, status_code=201)
def criar_lote(data: LoteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lote = Lote(**data.model_dump(), user_id=current_user.id)
    db.add(lote)
    db.commit()
    db.refresh(lote)
    out = LoteOut.model_validate(lote)
    out.total_animais = 0
    return out


@router.get("/{lote_id}", response_model=LoteOut)
def get_lote(lote_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lote = db.query(Lote).filter(Lote.id == lote_id, Lote.user_id == current_user.id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    total = db.query(Animal).filter(Animal.lote_id == lote.id, Animal.status == "ativo").count()
    out = LoteOut.model_validate(lote)
    out.total_animais = total
    return out


@router.put("/{lote_id}", response_model=LoteOut)
def atualizar_lote(lote_id: int, data: LoteUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lote = db.query(Lote).filter(Lote.id == lote_id, Lote.user_id == current_user.id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lote, field, value)
    db.commit()
    db.refresh(lote)
    total = db.query(Animal).filter(Animal.lote_id == lote.id, Animal.status == "ativo").count()
    out = LoteOut.model_validate(lote)
    out.total_animais = total
    return out


@router.delete("/{lote_id}", status_code=204)
def deletar_lote(lote_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lote = db.query(Lote).filter(Lote.id == lote_id, Lote.user_id == current_user.id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    db.delete(lote)
    db.commit()
