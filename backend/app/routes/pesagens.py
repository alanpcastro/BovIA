from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models.pesagem import Pesagem
from ..models.animal import Animal
from ..schemas.pesagem import PesagemCreate, PesagemOut
from ..auth import get_current_user, check_assinatura_ativa
from ..models.user import User

router = APIRouter()


class BulkDeleteIn(BaseModel):
    animal_ids: List[int]


class BulkResult(BaseModel):
    total: int
    afetados: int


def _calcular_gmd(db: Session, animal_id: int, pesagem_atual: Pesagem, user_id: int) -> float | None:
    # Busca a pesagem imediatamente anterior deste animal
    anterior = (
        db.query(Pesagem)
        .join(Animal)
        .filter(
            Animal.id == animal_id,
            Animal.user_id == user_id,
            Pesagem.data < pesagem_atual.data
        )
        .order_by(Pesagem.data.desc())
        .first()
    )

    if not anterior:
        # Se nao tem pesagem anterior, tenta usar o peso_entrada do animal
        animal = db.query(Animal).filter(Animal.id == animal_id).first()
        if animal and animal.peso_entrada and animal.data_nascimento:
            peso_ant = animal.peso_entrada
            data_ant = animal.data_nascimento
        else:
            return None
    else:
        peso_ant = anterior.peso_kg
        data_ant = anterior.data

    dias = (pesagem_atual.data - data_ant).days
    if dias <= 0:
        return None

    ganho = pesagem_atual.peso_kg - peso_ant
    return round(ganho / dias, 3)


@router.get("", response_model=List[PesagemOut])
def listar_pesagens(
    animal_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Pesagem).join(Animal).filter(
        Animal.user_id == current_user.id,
        Animal.deletado_em.is_(None),
    )
    if animal_id:
        q = q.filter(Pesagem.animal_id == animal_id)

    pesagens = q.order_by(Pesagem.data.desc()).all()

    # Adiciona GMD calculado na saida
    result = []
    for p in pesagens:
        out = PesagemOut.model_validate(p)
        out.gmd = _calcular_gmd(db, p.animal_id, p, current_user.id)
        result.append(out)
    return result


@router.post("", response_model=PesagemOut, status_code=201)
def criar_pesagem(data: PesagemCreate, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
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


@router.post("/bulk-delete", response_model=BulkResult)
def bulk_delete_pesagens(
    data: BulkDeleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    if not data.animal_ids:
        raise HTTPException(status_code=400, detail="Nenhum animal selecionado")

    # Deleta as ultimas pesagens dos animais selecionados
    pesagens = db.query(Pesagem).join(Animal).filter(
        Animal.id.in_(data.animal_ids),
        Animal.user_id == current_user.id,
    ).all()

    for p in pesagens:
        db.delete(p)

    db.commit()
    return BulkResult(total=len(data.animal_ids), afetados=len(pesagens))


@router.delete("/{pesagem_id}", status_code=204)
def deletar_pesagem(pesagem_id: int, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    pesagem = db.query(Pesagem).join(Animal).filter(
        Pesagem.id == pesagem_id, Animal.user_id == current_user.id
    ).first()
    if not pesagem:
        raise HTTPException(status_code=404, detail="Pesagem não encontrada")
    db.delete(pesagem)
    db.commit()
