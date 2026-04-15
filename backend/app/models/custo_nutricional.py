from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class CustoNutricional(Base):
    __tablename__ = "custos_nutricionais"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lote_id = Column(Integer, ForeignKey("lotes.id"), nullable=True)

    produto = Column(String, nullable=False)
    preco_kg = Column(Float, nullable=False)
    consumo_kg_dia = Column(Float, nullable=False)
    data_inicio = Column(Date, nullable=False)
    data_fim = Column(Date, nullable=True)
    observacoes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("User")
    lote = relationship("Lote")
