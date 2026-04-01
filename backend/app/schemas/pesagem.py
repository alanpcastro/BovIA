from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime


class PesagemCreate(BaseModel):
    animal_id: int
    data: date
    peso_kg: float
    observacoes: Optional[str] = None

    @field_validator('peso_kg')
    @classmethod
    def peso_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError('Peso deve ser maior que zero')
        if v > 3000:
            raise ValueError('Peso inválido: máximo 3000 kg')
        return v

    @field_validator('data')
    @classmethod
    def data_nao_futura(cls, v: date) -> date:
        if v > date.today():
            raise ValueError('Data da pesagem não pode ser futura')
        return v


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
