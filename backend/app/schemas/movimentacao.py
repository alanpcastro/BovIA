from pydantic import BaseModel, field_validator, computed_field
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
    preco_arroba: Optional[float] = None
    agio_compra: Optional[float] = None
    frete: Optional[float] = None
    desconto: Optional[float] = None
    origem: Optional[str] = None
    destino: Optional[str] = None
    observacoes: Optional[str] = None

    @field_validator('data')
    @classmethod
    def data_nao_futura(cls, v: date) -> date:
        if v > date.today():
            raise ValueError('Data da movimentacao nao pode ser futura')
        return v

    @field_validator('valor')
    @classmethod
    def valor_positivo(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('Valor nao pode ser negativo')
        return v

    @field_validator('peso_kg')
    @classmethod
    def peso_valido(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if v <= 0:
                raise ValueError('Peso deve ser maior que zero')
            if v > 2000:
                raise ValueError('Peso invalido: maximo 2000 kg')
        return v

    @field_validator('preco_arroba')
    @classmethod
    def preco_arroba_positivo(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('Preco da arroba nao pode ser negativo')
        return v

    @field_validator('agio_compra')
    @classmethod
    def agio_positivo(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('Agio nao pode ser negativo')
        return v

    @field_validator('frete')
    @classmethod
    def frete_positivo(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('Frete nao pode ser negativo')
        return v

    @field_validator('desconto')
    @classmethod
    def desconto_positivo(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('Desconto nao pode ser negativo')
        return v


class MovimentacaoOut(BaseModel):
    id: int
    animal_id: int
    tipo: TipoMovEnum
    data: date
    valor: Optional[float]
    peso_kg: Optional[float]
    preco_arroba: Optional[float]
    agio_compra: Optional[float]
    frete: Optional[float]
    desconto: Optional[float]
    origem: Optional[str]
    destino: Optional[str]
    observacoes: Optional[str]
    created_at: datetime

    @computed_field
    @property
    def custo_kg(self) -> Optional[float]:
        if self.valor and self.peso_kg and self.peso_kg > 0:
            return round(self.valor / self.peso_kg, 2)
        return None

    class Config:
        from_attributes = True
