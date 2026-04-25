from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class StatusPastoEnum(str, enum.Enum):
    disponivel = "disponivel"
    ocupado = "ocupado"
    descanso = "descanso"


class Pasto(Base):
    __tablename__ = "pastos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    nome = Column(String, nullable=False)
    area_ha = Column(Float, nullable=False)
    capacidade_ua_ha = Column(Float, nullable=True, default=1.5)  # UA/ha suportada
    status = Column(Enum(StatusPastoEnum), default=StatusPastoEnum.disponivel, nullable=False)
    descricao = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lotes = relationship("Lote", back_populates="pasto_atual")
    historicos = relationship("HistoricoOcupacao", back_populates="pasto", cascade="all, delete-orphan")


class HistoricoOcupacao(Base):
    __tablename__ = "historico_ocupacao"

    id = Column(Integer, primary_key=True, index=True)
    pasto_id = Column(Integer, ForeignKey("pastos.id"), nullable=False)
    lote_id = Column(Integer, ForeignKey("lotes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    data_entrada = Column(Date, nullable=False)
    data_saida = Column(Date, nullable=True)
    observacoes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    pasto = relationship("Pasto", back_populates="historicos")
    lote = relationship("Lote")
