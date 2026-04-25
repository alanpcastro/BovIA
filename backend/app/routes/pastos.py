from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from datetime import date

from ..database import get_db
from ..models.pasto import Pasto, HistoricoOcupacao, StatusPastoEnum
from ..models.lote import Lote
from ..models.animal import Animal, StatusEnum
from ..models.pesagem import Pesagem
from ..schemas.pasto import (
    PastoCreate, PastoUpdate, PastoOut, LoteNoPasto,
    OcuparPastoIn, DesocuparPastoIn, HistoricoOcupacaoOut, AlertaPasto,
)
from ..auth import get_current_user
from ..models.user import User

router = APIRouter()

UA_KG = 450.0  # 1 UA = 450 kg de peso vivo
LIMITE_DIAS_OCUPACAO = 45  # alerta de rotacao
LIMITE_DIAS_DESCANSO = 90  # descanso excessivo


def _get_pasto_or_404(pasto_id: int, db: Session, user: User) -> Pasto:
    p = db.query(Pasto).filter(Pasto.id == pasto_id, Pasto.user_id == user.id).first()
    if not p:
        raise HTTPException(404, "Pasto não encontrado")
    return p


def _ultima_pesagem_animal(animal_id: int, db: Session) -> float | None:
    p = (
        db.query(Pesagem)
        .filter(Pesagem.animal_id == animal_id)
        .order_by(desc(Pesagem.data))
        .first()
    )
    return p.peso_kg if p else None


def _peso_total_lote(lote_id: int, db: Session) -> tuple[int, float]:
    animais = db.query(Animal).filter(
        Animal.lote_id == lote_id,
        Animal.deletado_em == None,
        Animal.status == StatusEnum.ativo,
    ).all()
    total = 0.0
    for a in animais:
        peso = _ultima_pesagem_animal(a.id, db) or a.peso_entrada or 0
        total += peso
    return len(animais), total


def _build_pasto_out(pasto: Pasto, db: Session) -> PastoOut:
    lotes = db.query(Lote).filter(
        Lote.pasto_atual_id == pasto.id, Lote.user_id == pasto.user_id
    ).all()

    total_animais = 0
    peso_total = 0.0
    lotes_out: List[LoteNoPasto] = []
    for l in lotes:
        qtd, peso = _peso_total_lote(l.id, db)
        peso_medio = peso / qtd if qtd else None
        total_animais += qtd
        peso_total += peso
        lotes_out.append(LoteNoPasto(
            id=l.id, nome=l.nome, total_animais=qtd,
            peso_medio_kg=peso_medio, data_entrada_pasto=l.data_entrada_pasto,
        ))

    ua = peso_total / UA_KG if peso_total else 0
    taxa = ua / pasto.area_ha if pasto.area_ha else 0
    cap_total = (pasto.capacidade_ua_ha or 0) * pasto.area_ha
    ocupacao_pct = (ua / cap_total * 100) if cap_total else 0
    superlotado = pasto.capacidade_ua_ha is not None and taxa > pasto.capacidade_ua_ha

    # dias de ocupação/descanso: último histórico desse pasto
    ultimo = (
        db.query(HistoricoOcupacao)
        .filter(HistoricoOcupacao.pasto_id == pasto.id)
        .order_by(desc(HistoricoOcupacao.data_entrada))
        .first()
    )
    dias_ocupacao = None
    dias_descanso = None
    hoje = date.today()
    if ultimo:
        if ultimo.data_saida is None:
            dias_ocupacao = (hoje - ultimo.data_entrada).days
        else:
            dias_descanso = (hoje - ultimo.data_saida).days

    out = PastoOut(
        id=pasto.id,
        nome=pasto.nome,
        area_ha=pasto.area_ha,
        capacidade_ua_ha=pasto.capacidade_ua_ha,
        status=pasto.status.value if hasattr(pasto.status, "value") else str(pasto.status),
        descricao=pasto.descricao,
        created_at=pasto.created_at,
        total_animais=total_animais,
        peso_total_kg=round(peso_total, 1),
        unidades_animais=round(ua, 2),
        taxa_lotacao_ua_ha=round(taxa, 2),
        capacidade_total_ua=round(cap_total, 2),
        ocupacao_pct=round(ocupacao_pct, 1),
        superlotado=superlotado,
        dias_ocupacao=dias_ocupacao,
        dias_descanso=dias_descanso,
        lotes_no_pasto=lotes_out,
    )
    return out


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[PastoOut])
def listar_pastos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pastos = db.query(Pasto).filter(Pasto.user_id == current_user.id).order_by(Pasto.nome).all()
    return [_build_pasto_out(p, db) for p in pastos]


@router.post("", response_model=PastoOut, status_code=201)
def criar_pasto(data: PastoCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pasto = Pasto(**data.model_dump(), user_id=current_user.id)
    db.add(pasto)
    db.commit()
    db.refresh(pasto)
    return _build_pasto_out(pasto, db)


@router.get("/alertas", response_model=List[AlertaPasto])
def alertas_pastos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retorna alertas de superlotação e rotação."""
    pastos = db.query(Pasto).filter(Pasto.user_id == current_user.id).all()
    alertas: List[AlertaPasto] = []
    for p in pastos:
        out = _build_pasto_out(p, db)
        if out.superlotado:
            alertas.append(AlertaPasto(
                pasto_id=p.id, pasto_nome=p.nome, tipo="superlotacao",
                mensagem=f"{p.nome} está com {out.taxa_lotacao_ua_ha} UA/ha (capacidade {p.capacidade_ua_ha} UA/ha)",
                severidade="alta",
            ))
        if out.dias_ocupacao is not None and out.dias_ocupacao > LIMITE_DIAS_OCUPACAO:
            alertas.append(AlertaPasto(
                pasto_id=p.id, pasto_nome=p.nome, tipo="sem_rotacao",
                mensagem=f"{p.nome} está ocupado há {out.dias_ocupacao} dias — considere rotacionar",
                severidade="media",
            ))
        if out.dias_descanso is not None and out.dias_descanso > LIMITE_DIAS_DESCANSO:
            alertas.append(AlertaPasto(
                pasto_id=p.id, pasto_nome=p.nome, tipo="descanso_excedido",
                mensagem=f"{p.nome} em descanso há {out.dias_descanso} dias — pronto para ocupação",
                severidade="baixa",
            ))
    return alertas


@router.get("/{pasto_id}", response_model=PastoOut)
def get_pasto(pasto_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = _get_pasto_or_404(pasto_id, db, current_user)
    return _build_pasto_out(p, db)


@router.put("/{pasto_id}", response_model=PastoOut)
def atualizar_pasto(pasto_id: int, data: PastoUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = _get_pasto_or_404(pasto_id, db, current_user)
    payload = data.model_dump(exclude_unset=True)
    if "status" in payload and payload["status"] is not None:
        try:
            payload["status"] = StatusPastoEnum(payload["status"])
        except ValueError:
            raise HTTPException(400, "Status inválido")
    for k, v in payload.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _build_pasto_out(p, db)


@router.delete("/{pasto_id}", status_code=204)
def deletar_pasto(pasto_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = _get_pasto_or_404(pasto_id, db, current_user)
    ocupado = db.query(Lote).filter(Lote.pasto_atual_id == p.id).first()
    if ocupado:
        raise HTTPException(400, "Pasto está ocupado por lotes. Desocupe antes de excluir.")
    db.delete(p)
    db.commit()


# ── Ocupação / Desocupação ───────────────────────────────────────────────────

@router.post("/{pasto_id}/ocupar", response_model=PastoOut)
def ocupar_pasto(
    pasto_id: int,
    data: OcuparPastoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Coloca um lote no pasto."""
    pasto = _get_pasto_or_404(pasto_id, db, current_user)
    lote = db.query(Lote).filter(Lote.id == data.lote_id, Lote.user_id == current_user.id).first()
    if not lote:
        raise HTTPException(404, "Lote não encontrado")
    if data.data_entrada > date.today():
        raise HTTPException(400, "Data de entrada não pode ser futura")

    # Fecha histórico anterior desse lote, se estava em outro pasto
    anterior = (
        db.query(HistoricoOcupacao)
        .filter(HistoricoOcupacao.lote_id == lote.id, HistoricoOcupacao.data_saida == None)
        .first()
    )
    if anterior:
        anterior.data_saida = data.data_entrada

    lote.pasto_atual_id = pasto.id
    lote.data_entrada_pasto = data.data_entrada
    pasto.status = StatusPastoEnum.ocupado

    hist = HistoricoOcupacao(
        pasto_id=pasto.id, lote_id=lote.id, user_id=current_user.id,
        data_entrada=data.data_entrada, observacoes=data.observacoes,
    )
    db.add(hist)
    db.commit()
    db.refresh(pasto)
    return _build_pasto_out(pasto, db)


@router.post("/{pasto_id}/desocupar", response_model=PastoOut)
def desocupar_pasto(
    pasto_id: int,
    data: DesocuparPastoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pasto = _get_pasto_or_404(pasto_id, db, current_user)
    lote = db.query(Lote).filter(
        Lote.id == data.lote_id, Lote.pasto_atual_id == pasto.id, Lote.user_id == current_user.id
    ).first()
    if not lote:
        raise HTTPException(404, "Lote não está neste pasto")
    if data.data_saida > date.today():
        raise HTTPException(400, "Data de saída não pode ser futura")

    hist = (
        db.query(HistoricoOcupacao)
        .filter(
            HistoricoOcupacao.lote_id == lote.id,
            HistoricoOcupacao.pasto_id == pasto.id,
            HistoricoOcupacao.data_saida == None,
        )
        .first()
    )
    if hist:
        hist.data_saida = data.data_saida
        if data.motivo:
            hist.observacoes = (hist.observacoes or "") + f" | saída: {data.motivo}"

    lote.pasto_atual_id = None
    lote.data_entrada_pasto = None

    # Se nenhum outro lote no pasto, marca descanso
    ainda_ocupado = db.query(Lote).filter(Lote.pasto_atual_id == pasto.id).first()
    if not ainda_ocupado:
        pasto.status = StatusPastoEnum.descanso

    db.commit()
    db.refresh(pasto)
    return _build_pasto_out(pasto, db)


@router.get("/{pasto_id}/historico", response_model=List[HistoricoOcupacaoOut])
def historico_pasto(pasto_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_pasto_or_404(pasto_id, db, current_user)
    historicos = (
        db.query(HistoricoOcupacao)
        .filter(HistoricoOcupacao.pasto_id == pasto_id)
        .order_by(desc(HistoricoOcupacao.data_entrada))
        .all()
    )
    out = []
    for h in historicos:
        lote = db.query(Lote).filter(Lote.id == h.lote_id).first()
        dias = ((h.data_saida or date.today()) - h.data_entrada).days
        out.append(HistoricoOcupacaoOut(
            id=h.id, pasto_id=h.pasto_id, lote_id=h.lote_id,
            lote_nome=lote.nome if lote else None,
            data_entrada=h.data_entrada, data_saida=h.data_saida,
            dias=dias, observacoes=h.observacoes,
        ))
    return out
