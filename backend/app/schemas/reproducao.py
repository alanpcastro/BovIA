from pydantic import BaseModel, field_validator, model_validator
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
    bezerro_sexo: Optional[str] = None         # transiente: usado quando cria animal automatico
    bezerro_peso_kg: Optional[float] = None    # transiente: idem
    observacoes: Optional[str] = None

    @field_validator('data')
    @classmethod
    def data_nao_futura(cls, v: date) -> date:
        if v > date.today():
            raise ValueError('Data do evento nao pode ser futura')
        return v

    @model_validator(mode='after')
    def parto_apos_cobertura(self) -> 'ReproducaoCreate':
        if self.data_prevista_parto and self.data_prevista_parto <= self.data:
            raise ValueError('Data prevista de parto deve ser posterior a data do evento')
        return self


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
