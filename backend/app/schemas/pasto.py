from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime, date


class PastoCreate(BaseModel):
    nome: str
    area_ha: float
    capacidade_ua_ha: Optional[float] = 1.5
    descricao: Optional[str] = None

    @field_validator("area_ha")
    @classmethod
    def _area_positiva(cls, v):
        if v is None or v <= 0:
            raise ValueError("Área deve ser maior que zero")
        return v

    @field_validator("capacidade_ua_ha")
    @classmethod
    def _cap_positiva(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Capacidade deve ser maior que zero")
        return v


class PastoUpdate(BaseModel):
    nome: Optional[str] = None
    area_ha: Optional[float] = None
    capacidade_ua_ha: Optional[float] = None
    descricao: Optional[str] = None
    status: Optional[str] = None


class LoteNoPasto(BaseModel):
    id: int
    nome: str
    total_animais: int
    peso_medio_kg: Optional[float] = None
    data_entrada_pasto: Optional[date] = None


class PastoOut(BaseModel):
    id: int
    nome: str
    area_ha: float
    capacidade_ua_ha: Optional[float]
    status: str
    descricao: Optional[str]
    created_at: datetime

    # Calculados
    total_animais: int = 0
    peso_total_kg: float = 0
    unidades_animais: float = 0  # UA totais (peso_total / 450)
    taxa_lotacao_ua_ha: float = 0  # UA/ha atual
    capacidade_total_ua: float = 0  # capacidade_ua_ha * area_ha
    ocupacao_pct: float = 0  # taxa / capacidade
    superlotado: bool = False
    dias_ocupacao: Optional[int] = None
    dias_descanso: Optional[int] = None
    lotes_no_pasto: List[LoteNoPasto] = []

    class Config:
        from_attributes = True


class OcuparPastoIn(BaseModel):
    lote_id: int
    data_entrada: date
    observacoes: Optional[str] = None
    forcar: bool = False  # ignora bloqueio de descanso minimo


class DesocuparPastoIn(BaseModel):
    lote_id: int
    data_saida: date
    motivo: Optional[str] = None  # "venda", "descanso", "transferencia"


class HistoricoOcupacaoOut(BaseModel):
    id: int
    pasto_id: int
    lote_id: int
    lote_nome: Optional[str] = None
    data_entrada: date
    data_saida: Optional[date]
    dias: Optional[int] = None
    observacoes: Optional[str]

    class Config:
        from_attributes = True


class AlertaPasto(BaseModel):
    pasto_id: int
    pasto_nome: str
    tipo: str  # "superlotacao" | "descanso_excedido" | "sem_rotacao"
    mensagem: str
    severidade: str  # "alta" | "media" | "baixa"
