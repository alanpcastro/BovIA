from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from datetime import date, datetime
from enum import Enum


class TipoSaudeEnum(str, Enum):
    vacinacao = "vacinacao"
    vermifugacao = "vermifugacao"
    tratamento = "tratamento"
    exame = "exame"
    cirurgia = "cirurgia"


class SaudeCreate(BaseModel):
    animal_id: int
    tipo: TipoSaudeEnum
    data: date
    descricao: str
    medicamento: Optional[str] = None
    dose: Optional[str] = None
    custo: Optional[float] = None
    responsavel: Optional[str] = None
    proxima_data: Optional[date] = None
    observacoes: Optional[str] = None

    @field_validator('custo')
    @classmethod
    def custo_positivo(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('Custo não pode ser negativo')
        return v

    @model_validator(mode='after')
    def proxima_data_apos_data(self) -> 'SaudeCreate':
        if self.proxima_data and self.proxima_data <= self.data:
            raise ValueError('Próxima data deve ser posterior à data do registro')
        return self


class SaudeUpdate(BaseModel):
    tipo: Optional[TipoSaudeEnum] = None
    data: Optional[date] = None
    descricao: Optional[str] = None
    medicamento: Optional[str] = None
    dose: Optional[str] = None
    custo: Optional[float] = None
    responsavel: Optional[str] = None
    proxima_data: Optional[date] = None
    observacoes: Optional[str] = None


class SaudeOut(BaseModel):
    id: int
    animal_id: int
    tipo: TipoSaudeEnum
    data: date
    descricao: str
    medicamento: Optional[str]
    dose: Optional[str]
    custo: Optional[float]
    responsavel: Optional[str]
    proxima_data: Optional[date]
    observacoes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
