from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class PesagemCreate(BaseModel):
    animal_id: int
    data: date
    peso_kg: float
    observacoes: Optional[str] = None


class PesagemOut(BaseModel):
    id: int
    animal_id: int
    data: date
    peso_kg: float
    observacoes: Optional[str]
    created_at: datetime
    gmd: Optional[float] = None  # ganho médio diário calculado

    class Config:
        from_attributes = True
