"""Alertas dispensados pelo produtor — qualquer alerta pode sair da lista.

A chave de cada alerta identifica a OCORRENCIA, nao o tipo. Dispensar tira ESTE alerta sem
silenciar os proximos do mesmo tipo:

    vacina:{saude_id}                  a dose; o reforco cria outro registro, outra chave
    parto:{reproducao_id}              a cobertura; a proxima gestacao e outra
    abate:{animal_id}                  o animal
    {tipo}:{pasto_id}:{ocupacao_id}    a ocupacao do pasto; nova ocupacao, nova chave

Alerta agrupado (vacinacao de um lote) carrega a chave de cada dose do grupo.
"""
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from .models.alerta_dispensado import AlertaDispensado


def chave_dose(saude_id: int) -> str:
    return f"vacina:{saude_id}"


def chave_parto(reproducao_id: int) -> str:
    return f"parto:{reproducao_id}"


def chave_abate(animal_id: int) -> str:
    return f"abate:{animal_id}"


def chave_pasto(tipo: str, pasto_id: int, ocupacao_id: Optional[int]) -> str:
    return f"{tipo}:{pasto_id}:{ocupacao_id or 0}"


def chaves_dispensadas(db: Session, user_id: int) -> set[str]:
    return {
        c for (c,) in db.query(AlertaDispensado.chave).filter(AlertaDispensado.user_id == user_id).all()
    }


def dispensar(db: Session, user_id: int, chaves: Iterable[str]) -> int:
    """Grava as chaves ainda nao dispensadas. Idempotente: repetir nao duplica."""
    novas = set(chaves) - chaves_dispensadas(db, user_id)
    for c in novas:
        db.add(AlertaDispensado(user_id=user_id, chave=c))
    db.commit()
    return len(novas)


def restaurar(db: Session, user_id: int, chaves: Iterable[str]) -> int:
    """Devolve os alertas para a lista."""
    n = db.query(AlertaDispensado).filter(
        AlertaDispensado.user_id == user_id,
        AlertaDispensado.chave.in_(list(chaves)),
    ).delete(synchronize_session=False)
    db.commit()
    return n
