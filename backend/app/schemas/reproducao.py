from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from enum import Enum


class TipoReproducaoEnum(str, Enum):
    cobertura_natural = "cobertura_natural"
    inseminacao = "inseminacao"
    transferencia_embriao = "transferencia_embriao"
    parto = "parto"


class ReproducaoCreate(BaseModel):
    animal_id: int
    tipo: TipoReproducaoEnum
    data: date
    touro_brinco: Optional[str] = None
    resultado: Optional[str] = None
    data_prevista_parto: Optional[date] = None
    bezerro_brinco: Optional[str] = None
    observacoes: Optional[str] = None


class ReproducaoUpdate(BaseModel):
    tipo: Optional[TipoReproducaoEnum] = None
    data: Optional[date] = None
    touro_brinco: Optional[str] = None
    resultado: Optional[str] = None
    data_prevista_parto: Optional[date] = None
    bezerro_brinco: Optional[str] = None
    observacoes: Optional[str] = None


class ReproducaoOut(BaseModel):
    id: int
    animal_id: int
    tipo: TipoReproducaoEnum
    data: date
    touro_brinco: Optional[str]
    resultado: Optional[str]
    data_prevista_parto: Optional[date]
    bezerro_brinco: Optional[str]
    observacoes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
