"""Entrada e saida do rebanho: o status do animal acompanha as movimentacoes.

Venda, morte e transferencia (para outra propriedade) tiram o animal do rebanho. Todo caminho
que muda status passa por aqui — formulario de movimentacao, movimentacao em lote, edicao do
animal e alteracao em massa — para status e movimentacoes nao contarem historias diferentes:

- so animal ativo sai do rebanho: nao se vende duas vezes, nem se vende animal morto;
- sair do rebanho tira o animal do lote;
- apagar a ultima movimentacao de saida devolve o animal ao rebanho;
- status de saida que tem movimentacao registrada so muda apagando a movimentacao.

Antes, apagar uma venda lancada por engano deixava o animal "vendido" para sempre.
"""
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models.animal import Animal, StatusEnum
from .models.movimentacao import Movimentacao, TipoMovEnum

SAIDA_PARA_STATUS = {
    TipoMovEnum.venda: StatusEnum.vendido,
    TipoMovEnum.morte: StatusEnum.morto,
    TipoMovEnum.transferencia: StatusEnum.transferido,
}
STATUS_PARA_SAIDA = {status: tipo for tipo, status in SAIDA_PARA_STATUS.items()}

_ROTULO_SAIDA = {
    TipoMovEnum.venda: "venda",
    TipoMovEnum.morte: "morte",
    TipoMovEnum.transferencia: "transferência",
}


def _nome(animal: Animal) -> str:
    return f"#{animal.brinco}" if animal.brinco else (animal.nome or f"#{animal.id}")


def e_saida(tipo) -> bool:
    return TipoMovEnum(getattr(tipo, "value", tipo)) in SAIDA_PARA_STATUS


def exigir_no_rebanho(animal: Animal, tipo) -> None:
    """So animal ativo pode ter venda, morte ou transferencia registrada."""
    if animal.status != StatusEnum.ativo:
        tipo = TipoMovEnum(getattr(tipo, "value", tipo))
        raise HTTPException(
            status_code=400,
            detail=(f"O animal {_nome(animal)} não está mais no rebanho (status: "
                    f"{animal.status.value}). Não dá para registrar {_ROTULO_SAIDA[tipo]} para ele."),
        )


def aplicar_saida(animal: Animal, tipo) -> None:
    """Tira o animal do rebanho: status correspondente e fora do lote."""
    animal.status = SAIDA_PARA_STATUS[TipoMovEnum(getattr(tipo, "value", tipo))]
    animal.lote_id = None


def ultima_saida(db: Session, animal_id: int) -> Optional[Movimentacao]:
    return (
        db.query(Movimentacao)
        .filter(Movimentacao.animal_id == animal_id, Movimentacao.tipo.in_(list(SAIDA_PARA_STATUS)))
        .order_by(Movimentacao.data.desc(), Movimentacao.id.desc())
        .first()
    )


def reativar_se_sem_saida(db: Session, animal: Animal) -> bool:
    """Chamar depois de apagar movimentacao de saida. Sem nenhuma saida restante, o animal
    volta ao rebanho — sem lote: a movimentacao nao guarda de qual lote ele saiu (C7).
    Devolve True se reativou."""
    if animal.status == StatusEnum.ativo or ultima_saida(db, animal.id) is not None:
        return False
    animal.status = StatusEnum.ativo
    return True


def motivo_bloqueio_status(db: Session, animal: Animal, novo) -> Optional[str]:
    """Por que o status NAO pode mudar pela edicao — None se pode.

    Status de saida sustentado por movimentacao registrada so muda apagando a movimentacao
    (que devolve o animal ao rebanho sozinha). Status de saida SEM movimentacao — dado antigo,
    anterior a estas regras — pode ser corrigido pela edicao.
    """
    novo = StatusEnum(getattr(novo, "value", novo))
    if novo == animal.status or animal.status == StatusEnum.ativo:
        return None
    mov = ultima_saida(db, animal.id)
    if mov is None:
        return None
    return (f"O animal {_nome(animal)} tem {_ROTULO_SAIDA[mov.tipo]} registrada em "
            f"{mov.data.strftime('%d/%m/%Y')}. Para mudar o status, exclua essa movimentação em "
            f"Movimentações — o animal volta ao rebanho sozinho.")


def mudar_status(db: Session, animal: Animal, novo, user_id: int, hoje: Optional[date] = None) -> bool:
    """Mudanca de status pela edicao do animal (individual ou em massa). True se mudou.

    - mesmo status: nada (antes, salvar "vendido" de novo criava outra venda);
    - para saida (vendido/morto/transferido): registra a movimentacao, datada de hoje, e tira
      do lote — o mesmo que lancar a venda em Movimentacoes;
    - bloqueado: HTTPException 400 com o motivo (ver motivo_bloqueio_status).
    """
    novo = StatusEnum(getattr(novo, "value", novo))
    if novo == animal.status:
        return False
    motivo = motivo_bloqueio_status(db, animal, novo)
    if motivo:
        raise HTTPException(status_code=400, detail=motivo)
    if novo == StatusEnum.ativo:
        animal.status = StatusEnum.ativo
    else:
        tipo = STATUS_PARA_SAIDA[novo]
        # lote gravado antes de aplicar_saida tirar o animal dele (analise por lote, C7)
        db.add(Movimentacao(user_id=user_id, animal_id=animal.id, lote_id=animal.lote_id,
                            tipo=tipo, data=hoje or date.today()))
        aplicar_saida(animal, tipo)
    return True
