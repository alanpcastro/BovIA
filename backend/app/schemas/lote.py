from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class LoteCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    rendimento_carcaca: Optional[float] = 52.0
    ua_ha: Optional[float] = None
    data_entrada: Optional[date] = None


class LoteUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    rendimento_carcaca: Optional[float] = None
    ua_ha: Optional[float] = None
    data_entrada: Optional[date] = None


class LoteOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str]
    rendimento_carcaca: Optional[float]
    ua_ha: Optional[float] = None
    data_entrada: Optional[date] = None
    pasto_atual_id: Optional[int] = None
    pasto_atual_nome: Optional[str] = None
    data_entrada_pasto: Optional[date] = None
    created_at: datetime
    total_animais: Optional[int] = 0

    class Config:
        from_attributes = True
