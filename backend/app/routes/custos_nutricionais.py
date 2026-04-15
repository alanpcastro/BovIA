from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.custo_nutricional import CustoNutricional
from ..schemas.custo_nutricional import CustoNutricionalCreate, CustoNutricionalUpdate, CustoNutricionalOut
from ..auth import get_current_user
from ..models.user import User

router = APIRouter()


def _to_out(c: CustoNutricional) -> CustoNutricionalOut:
    out = CustoNutricionalOut.model_validate(c)
    out.custo_diario_cab = round(c.preco_kg * c.consumo_kg_dia, 2)
    return out


@router.get("", response_model=List[CustoNutricionalOut])
def listar(
    lote_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(CustoNutricional).filter(CustoNutricional.user_id == current_user.id)
    if lote_id is not None:
        q = q.filter(CustoNutricional.lote_id == lote_id)
    return [_to_out(c) for c in q.order_by(CustoNutricional.data_inicio.desc()).all()]


@router.post("", response_model=CustoNutricionalOut, status_code=201)
def criar(
    data: CustoNutricionalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    custo = CustoNutricional(**data.model_dump(), user_id=current_user.id)
    db.add(custo)
    db.commit()
    db.refresh(custo)
    return _to_out(custo)


@router.put("/{custo_id}", response_model=CustoNutricionalOut)
def atualizar(
    custo_id: int,
    data: CustoNutricionalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    custo = db.query(CustoNutricional).filter(
        CustoNutricional.id == custo_id, CustoNutricional.user_id == current_user.id
    ).first()
    if not custo:
        raise HTTPException(status_code=404, detail="Custo não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(custo, field, value)
    db.commit()
    db.refresh(custo)
    return _to_out(custo)


@router.delete("/{custo_id}", status_code=204)
def deletar(
    custo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    custo = db.query(CustoNutricional).filter(
        CustoNutricional.id == custo_id, CustoNutricional.user_id == current_user.id
    ).first()
    if not custo:
        raise HTTPException(status_code=404, detail="Custo não encontrado")
    db.delete(custo)
    db.commit()
