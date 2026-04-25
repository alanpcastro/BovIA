from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class CategoriaDespEnum(str, enum.Enum):
    mao_de_obra = "mao_de_obra"
    manutencao = "manutencao"
    energia = "energia"
    arrendamento = "arrendamento"
    impostos = "impostos"
    sal_mineral = "sal_mineral"
    suplemento = "suplemento"
    vermifugo = "vermifugo"
    combustivel = "combustivel"
    outros = "outros"


class DespesaFixa(Base):
    __tablename__ = "despesas_fixas"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    categoria = Column(Enum(CategoriaDespEnum), nullable=False)
    descricao = Column(String, nullable=False)
    valor_mensal = Column(Float, nullable=False)
    data_inicio = Column(Date, nullable=False)
    data_fim = Column(Date, nullable=True)
    observacoes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("User")
