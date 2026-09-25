"""Rota unificada de alertas: agrega vacinas, pastos, abate e partos numa lista cronologica."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, aliased
from sqlalchemy import desc, func, and_, or_, exists
from typing import List, Optional, Literal
from datetime import date, timedelta
from pydantic import BaseModel, field_validator

from ..database import get_db
from ..auth import get_current_user, check_assinatura_ativa
from ..dispensas import (
    chave_abate, chave_dose, chave_parto, chave_pasto, chaves_dispensadas, dispensar, restaurar,
)
from ..models.user import User
from ..models.animal import Animal, StatusEnum, SexoEnum, CategoriaAnimalEnum
from ..models.reproducao import Reproducao, TipoReproducaoEnum
from ..models.pesagem import Pesagem
from ..models.pasto import Pasto
from ..routes.pastos import _build_pasto_out, LIMITE_DIAS_OCUPACAO, LIMITE_DIAS_DESCANSO
from ..zootecnia import sanidade_pendente, agrupar_por_dose

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
    entidade_tipo: Literal["animal", "pasto", "lote", "grupo"]
    entidade_id: int  # em "grupo": o primeiro animal do grupo
    entidade_nome: Optional[str] = None
    link: str  # rota frontend, ex /animais/123
    # Ocorrencias que este alerta representa (app/dispensas.py). Dispensar envia todas —
    # o alerta agrupado de vacina tem uma chave por dose do grupo.
    chaves: List[str] = []


class ChavesIn(BaseModel):
    chaves: List[str]

    @field_validator("chaves")
    @classmethod
    def chaves_validas(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("Nenhum alerta informado")
        if len(v) > 2000:
            raise ValueError("Máximo de 2000 alertas por vez")
        if any(not c or len(c) > 100 for c in v):
            raise ValueError("Chave de alerta inválida")
        return v


def _severidade_por_dias(dias: int) -> str:
    if dias <= 3:
        return "alta"
    if dias <= 14:
        return "media"
    return "baixa"


@router.get("", response_model=List[Alerta])
def listar_alertas(
    dispensados: bool = Query(False, description="true = so os alertas que o produtor dispensou"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uid = current_user.id
    hoje = date.today()
    horizonte = hoje + timedelta(days=30)
    alertas: List[Alerta] = []

    # 1. Vacinas: dose pendente que vence nos proximos 30 dias ou JA venceu.
    # Atrasada nao some da lista com o tempo (antes sumia apos 7 dias) — so sai quando o
    # reforco e registrado. Doses iguais com o mesmo vencimento viram um alerta so: a
    # vacinacao de um lote de 50 animais e 1 cartao, nao 50.
    for grupo in agrupar_por_dose(sanidade_pendente(db, uid, ate=horizonte, dispensadas=dispensados)):
        s = grupo[0]
        dias = (s.proxima_data - hoje).days
        sev = "alta" if dias <= 0 else _severidade_por_dias(dias)
        prevista = s.proxima_data.strftime('%d/%m/%Y')
        nomes = [r.animal.brinco or r.animal.nome or f"#{r.animal_id}" for r in grupo]
        if len(grupo) == 1:
            quem, qtd = nomes[0], ""
        else:
            quem = ", ".join(nomes[:5]) + (f" e mais {len(nomes) - 5}" if len(nomes) > 5 else "")
            qtd = f" ({len(grupo)} animais)"
        if dias < 0:
            titulo = f"Vacina atrasada: {s.descricao}{qtd}"
            msg = f"{quem} — {s.descricao} estava prevista para {prevista} ({-dias} dias atrasada)"
        elif dias == 0:
            titulo = f"Vacina hoje: {s.descricao}{qtd}"
            msg = f"{quem} — {s.descricao} prevista para hoje"
        else:
            titulo = f"Vacina em {dias} dia(s): {s.descricao}{qtd}"
            msg = f"{quem} — {s.descricao} prevista para {prevista}"
        if len(grupo) == 1:
            alvo = dict(entidade_tipo="animal", entidade_id=s.animal_id, entidade_nome=nomes[0],
                        link=f"/animais/{s.animal_id}")
        else:
            # Grupo: a acao e registrar a dose para todos, feita na tela de Saude
            alvo = dict(entidade_tipo="grupo", entidade_id=s.animal_id,
                        entidade_nome=f"{len(grupo)} animais", link="/saude")
        alertas.append(Alerta(
            tipo="vacina", severidade=sev, titulo=titulo, mensagem=msg,
            data=s.proxima_data, dias=dias, chaves=[chave_dose(r.id) for r in grupo], **alvo,
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
                chaves=[chave_pasto("superlotacao", p.id, out.ocupacao_id)],
            ))
        if out.dias_ocupacao is not None and out.dias_ocupacao > LIMITE_DIAS_OCUPACAO:
            alertas.append(Alerta(
                tipo="sem_rotacao", severidade="media",
                titulo=f"Pasto {p.nome} sem rotação",
                mensagem=f"Ocupado há {out.dias_ocupacao} dias — considere rotacionar (limite {LIMITE_DIAS_OCUPACAO} dias)",
                dias=out.dias_ocupacao,
                entidade_tipo="pasto", entidade_id=p.id, entidade_nome=p.nome,
                link=f"/pastagens",
                chaves=[chave_pasto("sem_rotacao", p.id, out.ocupacao_id)],
            ))
        if out.dias_descanso is not None and out.dias_descanso > LIMITE_DIAS_DESCANSO:
            alertas.append(Alerta(
                tipo="descanso_excedido", severidade="baixa",
                titulo=f"Pasto {p.nome} pronto para ocupação",
                mensagem=f"Em descanso há {out.dias_descanso} dias",
                dias=out.dias_descanso,
                chaves=[chave_pasto("descanso_excedido", p.id, out.ocupacao_id)],
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
            chaves=[chave_abate(a.id)],
        ))

    # 4. Partos previstos (proximos 30 dias)
    # Filtra: cobertura nao resolvida (sem resultado terminal) E sem registro de parto subsequente
    RES_TERMINAIS = ("nasceu bezerro", "aborto", "vazia")
    Repro2 = aliased(Reproducao)
    ja_pariu = exists().where(
        and_(
            Repro2.animal_id == Reproducao.animal_id,
            Repro2.id != Reproducao.id,
            Repro2.data >= Reproducao.data,
            or_(
                Repro2.tipo == TipoReproducaoEnum.parto,
                Repro2.resultado.in_(RES_TERMINAIS),
            ),
        )
    )
    partos = (
        db.query(Reproducao).join(Animal)
        .filter(
            Animal.user_id == uid,
            Animal.status == StatusEnum.ativo,
            Animal.deletado_em.is_(None),
            Reproducao.data_prevista_parto.isnot(None),
            Reproducao.data_prevista_parto >= hoje - timedelta(days=7),
            Reproducao.data_prevista_parto <= horizonte,
            or_(
                Reproducao.resultado.is_(None),
                Reproducao.resultado.notin_(RES_TERMINAIS),
            ),
            ~ja_pariu,
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
            chaves=[chave_parto(r.id)],
        ))

    # Dispensados saem da lista normal; ?dispensados=true devolve so eles (para restaurar).
    ja = chaves_dispensadas(db, uid)
    alertas = [a for a in alertas if (bool(a.chaves) and all(c in ja for c in a.chaves)) == dispensados]

    # Ordena: severidade alta > media > baixa, depois por dias ascendente
    ordem_sev = {"alta": 0, "media": 1, "baixa": 2}
    alertas.sort(key=lambda x: (ordem_sev[x.severidade], x.dias if x.dias is not None else 9999))
    return alertas


@router.post("/dispensar")
def dispensar_alertas(
    data: ChavesIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    """Tira alertas da lista — qualquer tipo. Voltam com POST /alertas/restaurar."""
    return {"dispensados": dispensar(db, current_user.id, data.chaves)}


@router.post("/restaurar")
def restaurar_alertas(
    data: ChavesIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_assinatura_ativa),
):
    """Devolve alertas dispensados para a lista."""
    return {"restaurados": restaurar(db, current_user.id, data.chaves)}
