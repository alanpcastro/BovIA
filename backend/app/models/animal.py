from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class SexoEnum(str, enum.Enum):
    macho = "macho"
    femea = "femea"


class StatusEnum(str, enum.Enum):
    ativo = "ativo"
    vendido = "vendido"
    morto = "morto"
    transferido = "transferido"


class CategoriaAnimalEnum(str, enum.Enum):
    bezerro = "bezerro"        # macho ate desmame (~8 meses, ~200kg)
    garrote = "garrote"        # macho desmamado ate ~24 meses (200-360kg)
    novilha = "novilha"        # femea jovem que ainda nao pariu
    vaca = "vaca"              # femea adulta (ja pariu)
    boi_magro = "boi_magro"    # macho adulto em recria/engorda inicial
    boi_gordo = "boi_gordo"    # macho adulto pronto para abate


class Animal(Base):
    __tablename__ = "animais"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lote_id = Column(Integer, ForeignKey("lotes.id"), nullable=True)

    brinco = Column(String, nullable=True, index=True)
    nome = Column(String, nullable=True)
    raca = Column(String, nullable=True)
    sexo = Column(Enum(SexoEnum), nullable=False)
    categoria = Column(Enum(CategoriaAnimalEnum), nullable=True)
    data_nascimento = Column(Date, nullable=True)
    peso_entrada = Column(Float, nullable=True)
    origem = Column(String, nullable=True)  # nascido, comprado
    status = Column(Enum(StatusEnum), default=StatusEnum.ativo)
    observacoes = Column(String, nullable=True)
    foto_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deletado_em = Column(DateTime(timezone=True), nullable=True)

    usuario = relationship("User", back_populates="animais")
    lote = relationship("Lote", back_populates="animais")
    pesagens = relationship("Pesagem", back_populates="animal", cascade="all, delete-orphan")
    reproducoes = relationship("Reproducao", back_populates="animal", cascade="all, delete-orphan")
    saudes = relationship("Saude", back_populates="animal", cascade="all, delete-orphan")
    movimentacoes = relationship("Movimentacao", back_populates="animal", cascade="all, delete-orphan")
