from pydantic import BaseModel, field_validator
from typing import List, Optional
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


class PesagemLoteItem(BaseModel):
    """Uma leitura da balança: animal + peso. A data é comum ao lote todo."""
    animal_id: int
    peso_kg: float

    @field_validator('peso_kg')
    @classmethod
    def peso_positivo(cls, v: float) -> float:
        if v <= 0:
            raise ValueError('Peso deve ser maior que zero')
        if v > 3000:
            raise ValueError('Peso inválido: máximo 3000 kg')
        return v


class PesagemLoteCreate(BaseModel):
    """Sessão de curral: várias pesagens individuais enviadas de uma vez.

    Diferente de POST /lotes/{id}/pesagens, que aplica um peso MÉDIO a todos os
    animais do lote — aqui cada animal tem o seu peso real.
    """
    data: date
    itens: List[PesagemLoteItem]
    observacoes: Optional[str] = None

    @field_validator('data')
    @classmethod
    def data_nao_futura(cls, v: date) -> date:
        if v > date.today():
            raise ValueError('Data da pesagem não pode ser futura')
        return v

    @field_validator('itens')
    @classmethod
    def itens_validos(cls, v: List[PesagemLoteItem]) -> List[PesagemLoteItem]:
        if not v:
            raise ValueError('Nenhuma pesagem enviada')
        if len(v) > 500:
            raise ValueError('Máximo de 500 pesagens por envio')
        ids = [i.animal_id for i in v]
        if len(ids) != len(set(ids)):
            raise ValueError('Animal repetido na mesma sessão de pesagem')
        return v


class PesagemLoteResult(BaseModel):
    """Resumo da sessão, pra fechar o trabalho no curral com um número."""
    recebidos: int
    criados: int
    atualizados: int
    ignorados: int          # animais que não são do usuário / não existem
    peso_medio: Optional[float] = None
    gmd_medio: Optional[float] = None


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
