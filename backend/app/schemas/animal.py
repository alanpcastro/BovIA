from pydantic import BaseModel
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
    brinco: str
    nome: Optional[str] = None
    raca: Optional[str] = None
    sexo: SexoEnum
    data_nascimento: Optional[date] = None
    peso_entrada: Optional[float] = None
    origem: Optional[str] = None
    lote_id: Optional[int] = None
    observacoes: Optional[str] = None


class AnimalUpdate(BaseModel):
    nome: Optional[str] = None
    raca: Optional[str] = None
    sexo: Optional[SexoEnum] = None
    data_nascimento: Optional[date] = None
    peso_entrada: Optional[float] = None
    origem: Optional[str] = None
    lote_id: Optional[int] = None
    status: Optional[StatusEnum] = None
    observacoes: Optional[str] = None


class AnimalOut(BaseModel):
    id: int
    brinco: str
    nome: Optional[str]
    raca: Optional[str]
    sexo: SexoEnum
    data_nascimento: Optional[date]
    peso_entrada: Optional[float]
    origem: Optional[str]
    lote_id: Optional[int]
    status: StatusEnum
    observacoes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
