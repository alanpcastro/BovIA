from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from datetime import date, datetime


class CustoNutricionalCreate(BaseModel):
    lote_id: Optional[int] = None
    produto: str
    preco_kg: float
    consumo_kg_dia: float
    data_inicio: date
    data_fim: Optional[date] = None
    observacoes: Optional[str] = None

    @field_validator('preco_kg')
    @classmethod
    def preco_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError('Preço por kg deve ser maior que zero')
        return v

    @field_validator('consumo_kg_dia')
    @classmethod
    def consumo_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError('Consumo diário deve ser maior que zero')
        return v

    @model_validator(mode='after')
    def data_fim_apos_inicio(self) -> 'CustoNutricionalCreate':
        if self.data_fim and self.data_fim <= self.data_inicio:
            raise ValueError('Data fim deve ser posterior à data início')
        return self


class CustoNutricionalUpdate(BaseModel):
    lote_id: Optional[int] = None
    produto: Optional[str] = None
    preco_kg: Optional[float] = None
    consumo_kg_dia: Optional[float] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    observacoes: Optional[str] = None


class CustoNutricionalOut(BaseModel):
    id: int
    lote_id: Optional[int]
    produto: str
    preco_kg: float
    consumo_kg_dia: float
    custo_diario_cab: Optional[float] = None
    data_inicio: date
    data_fim: Optional[date]
    observacoes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
