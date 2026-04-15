from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Lote(Base):
    __tablename__ = "lotes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    nome = Column(String, nullable=False)
    area_hectares = Column(Float, nullable=True)
    descricao = Column(String, nullable=True)
    rendimento_carcaca = Column(Float, nullable=True, default=52.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("User", back_populates="lotes")
    animais = relationship("Animal", back_populates="lote")
