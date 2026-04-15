from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from datetime import date, datetime
from enum import Enum


class CategoriaDespEnum(str, Enum):
    mao_de_obra = "mao_de_obra"
    manutencao = "manutencao"
    energia = "energia"
    arrendamento = "arrendamento"
    impostos = "impostos"
    outros = "outros"


class DespesaFixaCreate(BaseModel):
    categoria: CategoriaDespEnum
    descricao: str
    valor_mensal: float
    data_inicio: date
    data_fim: Optional[date] = None
    observacoes: Optional[str] = None

    @field_validator('valor_mensal')
    @classmethod
    def valor_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError('Valor mensal deve ser maior que zero')
        return v

    @model_validator(mode='after')
    def data_fim_apos_inicio(self) -> 'DespesaFixaCreate':
        if self.data_fim and self.data_fim <= self.data_inicio:
            raise ValueError('Data fim deve ser posterior a data inicio')
        return self


class DespesaFixaUpdate(BaseModel):
    categoria: Optional[CategoriaDespEnum] = None
    descricao: Optional[str] = None
    valor_mensal: Optional[float] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    observacoes: Optional[str] = None


class DespesaFixaOut(BaseModel):
    id: int
    categoria: CategoriaDespEnum
    descricao: str
    valor_mensal: float
    data_inicio: date
    data_fim: Optional[date]
    observacoes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
