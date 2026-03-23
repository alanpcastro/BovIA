from sqlalchemy import Column, Integer, Float, Date, ForeignKey, DateTime, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Pesagem(Base):
    __tablename__ = "pesagens"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(Integer, ForeignKey("animais.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    data = Column(Date, nullable=False)
    peso_kg = Column(Float, nullable=False)
    observacoes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    animal = relationship("Animal", back_populates="pesagens")
