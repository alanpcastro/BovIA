import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class PlanoEnum(str, enum.Enum):
    gratuito = "gratuito"
    bronze = "bronze"
    prata = "prata"
    ouro = "ouro"


class AssinaturaStatusEnum(str, enum.Enum):
    ativo = "ativo"
    inadimplente = "inadimplente"
    cancelado = "cancelado"
    expirado = "expirado"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    senha_hash = Column(String, nullable=False)
    fazenda_nome = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Campos de Assinatura (SaaS)
    plano = Column(Enum(PlanoEnum), default=PlanoEnum.gratuito)
    assinatura_status = Column(Enum(AssinaturaStatusEnum), default=AssinaturaStatusEnum.ativo)
    assinatura_expira_em = Column(DateTime(timezone=True), nullable=True)
    stripe_customer_id = Column(String, nullable=True)

    animais = relationship("Animal", back_populates="usuario")
    lotes = relationship("Lote", back_populates="usuario")
    movimentacoes = relationship("Movimentacao", back_populates="usuario")
