from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime
from enum import Enum


class SexoEnum(str, Enum):
    macho = "macho"
    femea = "femea"


class StatusEnum(str, Enum):
    ativo = "ativo"
    vendido = "vendido"
    morto = "morto"
    transferido = "transferido"


class AnimalCreate(BaseModel):
    brinco: Optional[str] = None
    nome: Optional[str] = None
    raca: Optional[str] = None
    sexo: SexoEnum
    data_nascimento: Optional[date] = None
    peso_entrada: Optional[float] = None
    origem: Optional[str] = None
    lote_id: Optional[int] = None
    observacoes: Optional[str] = None

    @field_validator('brinco')
    @classmethod
    def brinco_nao_vazio(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) > 50:
            raise ValueError('Brinco deve ter no máximo 50 caracteres')
        return v or None

    @field_validator('peso_entrada')
    @classmethod
    def peso_positivo(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError('Peso deve ser maior que zero')
        return v

    @field_validator('data_nascimento')
    @classmethod
    def data_nao_futura(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v > date.today():
            raise ValueError('Data de nascimento não pode ser futura')
        return v


class AnimalUpdate(BaseModel):
    brinco: Optional[str] = None
    nome: Optional[str] = None
    raca: Optional[str] = None
    sexo: Optional[SexoEnum] = None
    data_nascimento: Optional[date] = None
    peso_entrada: Optional[float] = None
    origem: Optional[str] = None
    lote_id: Optional[int] = None
    status: Optional[StatusEnum] = None
    observacoes: Optional[str] = None

    @field_validator('brinco')
    @classmethod
    def brinco_nao_vazio(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) > 50:
            raise ValueError('Brinco deve ter no maximo 50 caracteres')
        return v or None

    @field_validator('peso_entrada')
    @classmethod
    def peso_positivo(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError('Peso deve ser maior que zero')
        return v

    @field_validator('data_nascimento')
    @classmethod
    def data_nao_futura(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v > date.today():
            raise ValueError('Data de nascimento nao pode ser futura')
        return v


class AnimalOut(BaseModel):
    id: int
    brinco: Optional[str]
    nome: Optional[str]
    raca: Optional[str]
    sexo: SexoEnum
    data_nascimento: Optional[date]
    peso_entrada: Optional[float]
    origem: Optional[str]
    lote_id: Optional[int]
    status: StatusEnum
    observacoes: Optional[str]
    foto_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
