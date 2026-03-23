from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class TipoReproducaoEnum(str, enum.Enum):
    cobertura_natural = "cobertura_natural"
    inseminacao = "inseminacao"
    transferencia_embriao = "transferencia_embriao"
    parto = "parto"


class Reproducao(Base):
    __tablename__ = "reproducoes"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(Integer, ForeignKey("animais.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    tipo = Column(Enum(TipoReproducaoEnum), nullable=False)
    data = Column(Date, nullable=False)
    touro_brinco = Column(String, nullable=True)
    resultado = Column(String, nullable=True)  # prenha, vazia, nasceu bezerro
    data_prevista_parto = Column(Date, nullable=True)
    bezerro_brinco = Column(String, nullable=True)
    observacoes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    animal = relationship("Animal", back_populates="reproducoes")
