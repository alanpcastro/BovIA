from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class TipoSaudeEnum(str, enum.Enum):
    vacinacao = "vacinacao"
    vermifugacao = "vermifugacao"
    tratamento = "tratamento"
    exame = "exame"
    cirurgia = "cirurgia"


class Saude(Base):
    __tablename__ = "saudes"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(Integer, ForeignKey("animais.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    tipo = Column(Enum(TipoSaudeEnum), nullable=False)
    data = Column(Date, nullable=False)
    descricao = Column(String, nullable=False)
    medicamento = Column(String, nullable=True)
    dose = Column(String, nullable=True)
    custo = Column(Float, nullable=True)
    responsavel = Column(String, nullable=True)
    proxima_data = Column(Date, nullable=True)
    observacoes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    animal = relationship("Animal", back_populates="saudes")
