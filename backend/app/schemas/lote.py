from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LoteCreate(BaseModel):
    nome: str
    area_hectares: Optional[float] = None
    descricao: Optional[str] = None
    rendimento_carcaca: Optional[float] = 52.0


class LoteUpdate(BaseModel):
    nome: Optional[str] = None
    area_hectares: Optional[float] = None
    descricao: Optional[str] = None
    rendimento_carcaca: Optional[float] = None


class LoteOut(BaseModel):
    id: int
    nome: str
    area_hectares: Optional[float]
    descricao: Optional[str]
    rendimento_carcaca: Optional[float]
    created_at: datetime
    total_animais: Optional[int] = 0

    class Config:
        from_attributes = True
