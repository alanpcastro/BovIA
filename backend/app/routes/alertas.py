"""Rota unificada de alertas: agrega vacinas, pastos, abate e partos numa lista cronologica."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional, Literal
from datetime import date, timedelta
from pydantic import BaseModel

from ..database import get_db
from ..auth import get_current_user
from ..models.user import User
from ..models.animal import Animal, StatusEnum, SexoEnum, CategoriaAnimalEnum
from ..models.saude import Saude
from ..models.reproducao import Reproducao
from ..models.pesagem import Pesagem
from ..models.pasto import Pasto
from ..routes.pastos import _build_pasto_out, LIMITE_DIAS_OCUPACAO, LIMITE_DIAS_DESCANSO

router = APIRouter()


PESO_ABATE_MINIMO = 480.0  # kg de peso vivo (macho) para sugerir abate


class Alerta(BaseModel):
    tipo: Literal[
        "vacina", "superlotacao", "sem_rotacao", "descanso_excedido",
        "abate", "parto",
    ]
    severidade: Literal["alta", "media", "baixa"]
    titulo: str
    mensagem: str
    data: Optional[date] = None  # quando o evento e/foi
    dias: Optional[int] = None   # dias ate a data (negativo = atrasado)
    entidade_tipo: Literal["animal", "pasto", "lote"]
    entidade_id: int
    entidade_nome: Optional[str] = None
    link: str  # rota frontend, ex /animais/123


def _severidade_por_dias(dias: int) -> str:
    if dias <= 3:
        return "alta"
    if dias <= 14:
        return "media"
    return "baixa"


@router.get("", response_model=List[Alerta])
def listar_alertas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uid = current_user.id
    hoje = date.today()
    horizonte = hoje + timedelta(days=30)
    alertas: List[Alerta] = []

    # 1. Vacinas com proxima_data nos proximos 30 dias (ou atrasadas ate 7 dias)
    vacinas = (
        db.query(Saude).join(Animal)
        .filter(
            Animal.user_id == uid,
            Animal.status == StatusEnum.ativo,
            Animal.deletado_em.is_(None),
            Saude.proxima_data.isnot(None),
            Saude.proxima_data >= hoje - timedelta(days=7),
            Saude.proxima_data <= horizonte,
        )
        .order_by(Saude.proxima_data)
        .all()
    )
    for s in vacinas:
        dias = (s.proxima_data - hoje).days
        sev = "alta" if dias <= 0 else _severidade_por_dias(dias)
        nome = s.animal.brinco or s.animal.nome or f"#{s.animal_id}"
        if dias < 0:
            titulo = f"Vacina atrasada: {s.descricao}"
            msg = f"{nome} — {s.descricao} estava prevista para {s.proxima_data.strftime('%d/%m/%Y')} ({-dias} dias atrasada)"
        elif dias == 0:
            titulo = f"Vacina hoje: {s.descricao}"
            msg = f"{nome} precisa de {s.descricao} hoje"
        else:
            titulo = f"Vacina em {dias} dia(s): {s.descricao}"
            msg = f"{nome} — {s.descricao} prevista para {s.proxima_data.strftime('%d/%m/%Y')}"
        alertas.append(Alerta(
            tipo="vacina", severidade=sev, titulo=titulo, mensagem=msg,
            data=s.proxima_data, dias=dias,
            entidade_tipo="animal", entidade_id=s.animal_id, entidade_nome=nome,
            link=f"/animais/{s.animal_id}",
        ))

    # 2. Pastos: superlotacao, sem rotacao, descanso excedido
    pastos = db.query(Pasto).filter(Pasto.user_id == uid).all()
    for p in pastos:
        out = _build_pasto_out(p, db)
        if out.superlotado:
            alertas.append(Alerta(
                tipo="superlotacao", severidade="alta",
                titulo=f"Pasto {p.nome} superlotado",
                mensagem=f"{out.taxa_lotacao_ua_ha} UA/ha (capacidade {p.capacidade_ua_ha} UA/ha)",
                entidade_tipo="pasto", entidade_id=p.id, entidade_nome=p.nome,
                link=f"/pastagens",
            ))
        if out.dias_ocupacao is not None and out.dias_ocupacao > LIMITE_DIAS_OCUPACAO:
            alertas.append(Alerta(
                tipo="sem_rotacao", severidade="media",
                titulo=f"Pasto {p.nome} sem rotação",
                mensagem=f"Ocupado há {out.dias_ocupacao} dias — considere rotacionar (limite {LIMITE_DIAS_OCUPACAO} dias)",
                dias=out.dias_ocupacao,
                entidade_tipo="pasto", entidade_id=p.id, entidade_nome=p.nome,
                link=f"/pastagens",
            ))
        if out.dias_descanso is not None and out.dias_descanso > LIMITE_DIAS_DESCANSO:
            alertas.append(Alerta(
                tipo="descanso_excedido", severidade="baixa",
                titulo=f"Pasto {p.nome} pronto para ocupação",
                mensagem=f"Em descanso há {out.dias_descanso} dias",
                dias=out.dias_descanso,
                entidade_tipo="pasto", entidade_id=p.id, entidade_nome=p.nome,
                link=f"/pastagens",
            ))

    # 3. Animais prontos para abate (machos ativos: categoria boi_gordo OU peso_atual >= 480kg)
    # Subquery: ultima pesagem por animal
    subq_ult = (
        db.query(Pesagem.animal_id, func.max(Pesagem.data).label("ultima_data"))
        .group_by(Pesagem.animal_id)
        .subquery()
    )
    machos_ativos = (
        db.query(Animal)
        .filter(
            Animal.user_id == uid,
            Animal.status == StatusEnum.ativo,
            Animal.deletado_em.is_(None),
            Animal.sexo == SexoEnum.macho,
        )
        .all()
    )
    for a in machos_ativos:
        ultima = (
            db.query(Pesagem)
            .filter(Pesagem.animal_id == a.id)
            .order_by(desc(Pesagem.data))
            .first()
        )
        peso_atual = ultima.peso_kg if ultima else (a.peso_entrada or 0)
        is_boi_gordo = a.categoria == CategoriaAnimalEnum.boi_gordo
        peso_alto = peso_atual >= PESO_ABATE_MINIMO
        if not (is_boi_gordo or peso_alto):
            continue
        nome = a.brinco or a.nome or f"#{a.id}"
        sev = "media" if is_boi_gordo and peso_alto else "baixa"
        alertas.append(Alerta(
            tipo="abate", severidade=sev,
            titulo=f"Pronto para abate: {nome}",
            mensagem=(
                f"Categoria {a.categoria.value if a.categoria else '—'} · peso atual {peso_atual:.0f} kg"
                if peso_atual else f"Categoria boi_gordo (sem pesagem registrada)"
            ),
            entidade_tipo="animal", entidade_id=a.id, entidade_nome=nome,
            link=f"/animais/{a.id}",
        ))

    # 4. Partos previstos (proximos 30 dias)
    partos = (
        db.query(Reproducao).join(Animal)
        .filter(
            Animal.user_id == uid,
            Animal.status == StatusEnum.ativo,
            Animal.deletado_em.is_(None),
            Reproducao.data_prevista_parto.isnot(None),
            Reproducao.data_prevista_parto >= hoje - timedelta(days=7),
            Reproducao.data_prevista_parto <= horizonte,
        )
        .order_by(Reproducao.data_prevista_parto)
        .all()
    )
    for r in partos:
        dias = (r.data_prevista_parto - hoje).days
        sev = "alta" if dias <= 3 else _severidade_por_dias(dias)
        nome = r.animal.brinco or r.animal.nome or f"#{r.animal_id}"
        if dias < 0:
            titulo = f"Parto previsto há {-dias} dia(s): {nome}"
            msg = f"Data prevista {r.data_prevista_parto.strftime('%d/%m/%Y')} (atrasada)"
        else:
            titulo = f"Parto em {dias} dia(s): {nome}"
            msg = f"Data prevista {r.data_prevista_parto.strftime('%d/%m/%Y')}"
        alertas.append(Alerta(
            tipo="parto", severidade=sev, titulo=titulo, mensagem=msg,
            data=r.data_prevista_parto, dias=dias,
            entidade_tipo="animal", entidade_id=r.animal_id, entidade_nome=nome,
            link=f"/animais/{r.animal_id}",
        ))

    # Ordena: severidade alta > media > baixa, depois por dias ascendente
    ordem_sev = {"alta": 0, "media": 1, "baixa": 2}
    alertas.sort(key=lambda x: (ordem_sev[x.severidade], x.dias if x.dias is not None else 9999))
    return alertas
