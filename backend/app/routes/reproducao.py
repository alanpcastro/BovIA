from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from ..database import get_db
from ..models.reproducao import Reproducao
from ..models.animal import Animal
from ..schemas.reproducao import ReproducaoCreate, ReproducaoUpdate, ReproducaoOut
from ..auth import get_current_user
from ..models.user import User

router = APIRouter()


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

    repro = Reproducao(**data.model_dump(), user_id=current_user.id)
    db.add(repro)
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


@router.delete("/{repro_id}", status_code=204)
def deletar_reproducao(repro_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    repro = db.query(Reproducao).join(Animal).filter(Reproducao.id == repro_id, Animal.user_id == current_user.id).first()
    if not repro:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    db.delete(repro)
    db.commit()
