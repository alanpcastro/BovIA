from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.pesagem import Pesagem
from ..models.animal import Animal
from ..schemas.pesagem import PesagemCreate, PesagemOut
from ..auth import get_current_user
from ..models.user import User

router = APIRouter()


def _calcular_gmd(db: Session, animal_id: int, nova_pesagem: Pesagem, user_id: int) -> Optional[float]:
    anterior = (
        db.query(Pesagem).join(Animal)
        .filter(
            Pesagem.animal_id == animal_id,
            Pesagem.data < nova_pesagem.data,
            Animal.user_id == user_id,
        )
        .order_by(Pesagem.data.desc())
        .first()
    )

    if anterior:
        peso_anterior = anterior.peso_kg
        data_anterior = anterior.data
    else:
        # Fallback: usa peso_entrada do cadastro como ponto de partida (1a pesagem)
        animal = db.query(Animal).filter(
            Animal.id == animal_id, Animal.user_id == user_id,
        ).first()
        if not animal or animal.peso_entrada is None:
            return None
        peso_anterior = animal.peso_entrada
        if animal.data_nascimento:
            data_anterior = animal.data_nascimento
        elif animal.created_at:
            data_anterior = animal.created_at.date()
        else:
            return None

    dias = (nova_pesagem.data - data_anterior).days
    if dias <= 0:
        return None
    return round((nova_pesagem.peso_kg - peso_anterior) / dias, 3)


@router.get("", response_model=List[PesagemOut])
def listar_pesagens(
    animal_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Pesagem).join(Animal).filter(Animal.user_id == current_user.id)
    if animal_id:
        q = q.filter(Pesagem.animal_id == animal_id)
    pesagens = q.order_by(Pesagem.data.desc()).all()

    result = []
    for p in pesagens:
        out = PesagemOut.model_validate(p)
        out.gmd = _calcular_gmd(db, p.animal_id, p, current_user.id)
        result.append(out)
    return result


@router.post("", response_model=PesagemOut, status_code=201)
def criar_pesagem(data: PesagemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    animal = db.query(Animal).filter(Animal.id == data.animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")

    pesagem = Pesagem(**data.model_dump(), user_id=current_user.id)
    db.add(pesagem)
    db.commit()
    db.refresh(pesagem)

    out = PesagemOut.model_validate(pesagem)
    out.gmd = _calcular_gmd(db, pesagem.animal_id, pesagem, current_user.id)
    return out


@router.delete("/{pesagem_id}", status_code=204)
def deletar_pesagem(pesagem_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pesagem = db.query(Pesagem).join(Animal).filter(
        Pesagem.id == pesagem_id, Animal.user_id == current_user.id
    ).first()
    if not pesagem:
        raise HTTPException(status_code=404, detail="Pesagem não encontrada")
    db.delete(pesagem)
    db.commit()
