from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.movimentacao import Movimentacao
from ..models.animal import Animal
from ..schemas.movimentacao import MovimentacaoCreate, MovimentacaoOut
from ..auth import get_current_user
from ..models.user import User

router = APIRouter()


@router.get("", response_model=List[MovimentacaoOut])
def listar_movimentacoes(
    animal_id: Optional[int] = Query(None),
    tipo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Movimentacao).filter(Movimentacao.user_id == current_user.id)
    if animal_id:
        q = q.filter(Movimentacao.animal_id == animal_id)
    if tipo:
        q = q.filter(Movimentacao.tipo == tipo)
    return q.order_by(Movimentacao.data.desc()).all()


@router.post("", response_model=MovimentacaoOut, status_code=201)
def criar_movimentacao(data: MovimentacaoCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    animal = db.query(Animal).filter(Animal.id == data.animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")

    mov = Movimentacao(**data.model_dump(), user_id=current_user.id)
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return mov


@router.get("/{mov_id}", response_model=MovimentacaoOut)
def get_movimentacao(mov_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    mov = db.query(Movimentacao).filter(Movimentacao.id == mov_id, Movimentacao.user_id == current_user.id).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    return mov
