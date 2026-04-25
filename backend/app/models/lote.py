from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Lote(Base):
    __tablename__ = "lotes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pasto_atual_id = Column(Integer, ForeignKey("pastos.id"), nullable=True)
    nome = Column(String, nullable=False)
    area_hectares = Column(Float, nullable=True)
    descricao = Column(String, nullable=True)
    rendimento_carcaca = Column(Float, nullable=True, default=52.0)
    data_entrada_pasto = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("User", back_populates="lotes")
    animais = relationship("Animal", back_populates="lote")
    pasto_atual = relationship("Pasto", back_populates="lotes")
