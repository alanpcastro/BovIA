from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from enum import Enum


class TipoMovEnum(str, Enum):
    compra = "compra"
    venda = "venda"
    transferencia = "transferencia"
    nascimento = "nascimento"
    morte = "morte"


class MovimentacaoCreate(BaseModel):
    animal_id: int
    tipo: TipoMovEnum
    data: date
    valor: Optional[float] = None
    peso_kg: Optional[float] = None
    origem: Optional[str] = None
    destino: Optional[str] = None
    observacoes: Optional[str] = None


class MovimentacaoOut(BaseModel):
    id: int
    animal_id: int
    tipo: TipoMovEnum
    data: date
    valor: Optional[float]
    peso_kg: Optional[float]
    origem: Optional[str]
    destino: Optional[str]
    observacoes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
