from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from ..database import Base


class AlertaDispensado(Base):
    """Alerta que o produtor tirou da lista.

    A chave identifica a OCORRENCIA do alerta (a dose, a cobertura, a ocupacao do pasto),
    nao o tipo — entao um alerta novo do mesmo tipo continua aparecendo. Formato das chaves
    em app/dispensas.py.
    """
    __tablename__ = "alertas_dispensados"
    __table_args__ = (
        UniqueConstraint("user_id", "chave", name="uq_alertas_dispensados_user_chave"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    chave = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
