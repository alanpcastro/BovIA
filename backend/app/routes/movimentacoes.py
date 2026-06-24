from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models.movimentacao import Movimentacao, TipoMovEnum
from ..models.animal import Animal
from ..schemas.movimentacao import MovimentacaoCreate, MovimentacaoOut
from ..auth import get_current_user, check_assinatura_ativa
from ..models.user import User

router = APIRouter()


class BulkDeleteIn(BaseModel):
    ids: List[int]


class BulkResult(BaseModel):
    total: int
    afetados: int


@router.get("", response_model=List[MovimentacaoOut])
def listar_movimentacoes(
    animal_id: Optional[int] = Query(None),
    tipo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Filtra movimentacoes de animais nao-deletados (mantem movimentacoes orfas escondidas)
    q = db.query(Movimentacao).join(Animal).filter(
        Movimentacao.user_id == current_user.id,
        Animal.deletado_em.is_(None),
    )
    if animal_id:
        q = q.filter(Movimentacao.animal_id == animal_id)
    if tipo:
        q = q.filter(Movimentacao.tipo == tipo)
    return q.order_by(Movimentacao.data.desc()).all()


@router.post("", response_model=MovimentacaoOut, status_code=201)
def criar_movimentacao(data: MovimentacaoCreate, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    animal = db.query(Animal).filter(Animal.id == data.animal_id, Animal.user_id == current_user.id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal não encontrado")

    mov = Movimentacao(**data.model_dump(), user_id=current_user.id)
    db.add(mov)

    # Sincronizar status do animal com a movimentação
    if data.tipo == TipoMovEnum.venda:
        animal.status = "vendido"
        animal.lote_id = None  # Remove do lote ao vender
    elif data.tipo == TipoMovEnum.morte:
        animal.status = "morto"
        animal.lote_id = None  # Remove do lote ao morrer

    db.commit()
    db.refresh(mov)
    return mov


@router.post("/bulk-delete", response_model=BulkResult)
def bulk_delete_movimentacoes(
    data: BulkDeleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    if not data.ids:
        raise HTTPException(status_code=400, detail="Nenhuma movimentação selecionada")
    movs = db.query(Movimentacao).filter(
        Movimentacao.id.in_(data.ids),
        Movimentacao.user_id == current_user.id,
    ).all()
    for m in movs:
        db.delete(m)
    db.commit()
    return BulkResult(total=len(data.ids), afetados=len(movs))


@router.get("/{mov_id}", response_model=MovimentacaoOut)
def get_movimentacao(mov_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    mov = db.query(Movimentacao).filter(Movimentacao.id == mov_id, Movimentacao.user_id == current_user.id).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    return mov


@router.delete("/{mov_id}", status_code=204)
def deletar_movimentacao(mov_id: int, db: Session = Depends(get_db), current_user: User = Depends(check_assinatura_ativa)):
    mov = db.query(Movimentacao).filter(Movimentacao.id == mov_id, Movimentacao.user_id == current_user.id).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    db.delete(mov)
    db.commit()
