from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db
from ..models.despesa_fixa import DespesaFixa
from ..schemas.despesa_fixa import DespesaFixaCreate, DespesaFixaUpdate, DespesaFixaOut
from ..auth import get_current_user
from ..models.user import User

router = APIRouter()


class BulkDeleteIn(BaseModel):
    ids: List[int]


class BulkResult(BaseModel):
    total: int
    afetados: int


@router.get("", response_model=List[DespesaFixaOut])
def listar(
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(DespesaFixa).filter(DespesaFixa.user_id == current_user.id)
    if categoria:
        q = q.filter(DespesaFixa.categoria == categoria)
    return q.order_by(DespesaFixa.data_inicio.desc()).all()


@router.post("", response_model=DespesaFixaOut, status_code=201)
def criar(
    data: DespesaFixaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    desp = DespesaFixa(**data.model_dump(), user_id=current_user.id)
    db.add(desp)
    db.commit()
    db.refresh(desp)
    return desp


@router.put("/{desp_id}", response_model=DespesaFixaOut)
def atualizar(
    desp_id: int,
    data: DespesaFixaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    desp = db.query(DespesaFixa).filter(
        DespesaFixa.id == desp_id, DespesaFixa.user_id == current_user.id
    ).first()
    if not desp:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(desp, field, value)
    db.commit()
    db.refresh(desp)
    return desp


@router.post("/bulk-delete", response_model=BulkResult)
def bulk_delete_despesas(
    data: BulkDeleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not data.ids:
        raise HTTPException(status_code=400, detail="Nenhuma despesa selecionada")
    despesas = db.query(DespesaFixa).filter(
        DespesaFixa.id.in_(data.ids),
        DespesaFixa.user_id == current_user.id,
    ).all()
    for d in despesas:
        db.delete(d)
    db.commit()
    return BulkResult(total=len(data.ids), afetados=len(despesas))


@router.delete("/{desp_id}", status_code=204)
def deletar(
    desp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    desp = db.query(DespesaFixa).filter(
        DespesaFixa.id == desp_id, DespesaFixa.user_id == current_user.id
    ).first()
    if not desp:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    db.delete(desp)
    db.commit()
