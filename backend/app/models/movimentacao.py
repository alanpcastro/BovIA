from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class TipoMovEnum(str, enum.Enum):
    compra = "compra"
    venda = "venda"
    transferencia = "transferencia"
    nascimento = "nascimento"
    morte = "morte"


class Movimentacao(Base):
    __tablename__ = "movimentacoes"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(Integer, ForeignKey("animais.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    tipo = Column(Enum(TipoMovEnum), nullable=False)
    data = Column(Date, nullable=False)
    valor = Column(Float, nullable=True)
    peso_kg = Column(Float, nullable=True)
    preco_arroba = Column(Float, nullable=True)
    agio_compra = Column(Float, nullable=True)  # comissao do intermediario na compra
    frete = Column(Float, nullable=True)        # frete (sobretudo na compra)
    desconto = Column(Float, nullable=True)     # desconto concedido (sobretudo na venda)
    origem = Column(String, nullable=True)
    destino = Column(String, nullable=True)
    observacoes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    animal = relationship("Animal", back_populates="movimentacoes")
    usuario = relationship("User", back_populates="movimentacoes")
