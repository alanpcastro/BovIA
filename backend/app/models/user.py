from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    senha_hash = Column(String, nullable=False)
    fazenda_nome = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    animais = relationship("Animal", back_populates="usuario")
    lotes = relationship("Lote", back_populates="usuario")
    movimentacoes = relationship("Movimentacao", back_populates="usuario")
