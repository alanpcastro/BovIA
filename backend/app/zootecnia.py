"""Calculos de rebanho compartilhados por telas e relatorios.

Existe para que a mesma pergunta tenha a mesma resposta em todo o app: o ganho de peso
de um animal, e quantas cabecas estavam na fazenda em cada dia, sao calculados aqui e em
nenhum outro lugar. Antes, Pesagens e Financeiro davam GMDs diferentes para o mesmo
animal, e o custo de racao ignorava os animais vendidos no meio do periodo.
"""
from datetime import date
from typing import NamedTuple, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, contains_eager

from .dispensas import chave_dose, chaves_dispensadas
from .models.animal import Animal, StatusEnum
from .models.custo_nutricional import CustoNutricional
from .models.movimentacao import Movimentacao, TipoMovEnum
from .models.pesagem import Pesagem
from .models.saude import Saude


# ── Ganho de peso ────────────────────────────────────────────────────────────

def ponto_de_entrada(animal) -> Optional[tuple[float, date]]:
    """Peso e data em que o animal entrou — a referencia de ganho quando ainda nao ha
    pesagem anterior.

    NAO usar data_nascimento: peso_entrada e o peso quando o animal foi cadastrado (pode ter
    sido comprado adulto), nao o peso ao nascer. Prioriza a data de entrada informada; se
    vazia, usa a data de cadastro.
    """
    if not animal.peso_entrada:
        return None
    data = animal.data_entrada or (animal.created_at.date() if animal.created_at else None)
    if data is None:
        return None
    return animal.peso_entrada, data


def referencia_de_ganho(animal, pesagem_anterior) -> Optional[tuple[float, date]]:
    """De onde medir o ganho ate uma pesagem: a pesagem anterior, se houver; senao, a
    entrada do animal. E a regra que Pesagens e Financeiro precisam compartilhar."""
    if pesagem_anterior is not None:
        return pesagem_anterior.peso_kg, pesagem_anterior.data
    return ponto_de_entrada(animal)


def gmd_entre(peso_ini: float, data_ini: date, peso_fim: float, data_fim: date) -> Optional[float]:
    """Ganho medio diario entre dois pontos, sem arredondar. None se nao ha dias entre eles."""
    dias = (data_fim - data_ini).days
    if dias <= 0:
        return None
    return (peso_fim - peso_ini) / dias


def calcular_gmd(db: Session, animal_id: int, pesagem_atual: Pesagem, user_id: int) -> Optional[float]:
    """GMD de uma pesagem em relacao a referencia anterior (pesagem anterior ou entrada)."""
    anterior = (
        db.query(Pesagem)
        .join(Animal)
        .filter(
            Animal.id == animal_id,
            Animal.user_id == user_id,
            Pesagem.data < pesagem_atual.data,
        )
        .order_by(Pesagem.data.desc())
        .first()
    )
    animal = None
    if anterior is None:
        animal = db.query(Animal).filter(Animal.id == animal_id, Animal.user_id == user_id).first()
        if animal is None:
            return None
    ref = referencia_de_ganho(animal, anterior)
    if ref is None:
        return None
    gmd = gmd_entre(ref[0], ref[1], pesagem_atual.peso_kg, pesagem_atual.data)
    return round(gmd, 3) if gmd is not None else None


# ── Presenca no rebanho ──────────────────────────────────────────────────────

class Presenca(NamedTuple):
    lote_id: Optional[int]
    entrada: Optional[date]  # None = sem data conhecida: presente desde sempre
    saida: Optional[date]    # None = ainda no rebanho


SAIDAS_DO_REBANHO = (TipoMovEnum.venda, TipoMovEnum.morte, TipoMovEnum.transferencia)


def presencas(db: Session, user_id: int) -> list[Presenca]:
    """Intervalo em que cada animal esteve no rebanho — so com datas que o sistema conhece.

    - entrada: data_entrada; senao data_nascimento (nao pode estar presente antes de nascer);
      sem nenhuma das duas, sem limite inicial — o animal costuma ser cadastrado depois de ja
      estar na fazenda, e a data de cadastro nao diz quando ele chegou.
    - saida: data da ultima venda/morte/transferencia. Animal ativo nao tem saida.
    - animal inativo SEM movimentacao de saida fica de fora: nao ha como saber quando saiu.

    Limitacao conhecida: a venda tira o animal do lote (lote_id = None), entao animais que ja
    sairam nao contam na analise por lote.
    """
    animais = db.query(
        Animal.id, Animal.lote_id, Animal.status, Animal.data_entrada, Animal.data_nascimento,
    ).filter(Animal.user_id == user_id, Animal.deletado_em.is_(None)).all()

    saidas = dict(
        db.query(Movimentacao.animal_id, func.max(Movimentacao.data))
        .filter(Movimentacao.user_id == user_id, Movimentacao.tipo.in_(SAIDAS_DO_REBANHO))
        .group_by(Movimentacao.animal_id)
        .all()
    )

    out: list[Presenca] = []
    for a in animais:
        entrada = a.data_entrada or a.data_nascimento
        if a.status == StatusEnum.ativo:
            out.append(Presenca(a.lote_id, entrada, None))
        elif a.id in saidas:
            out.append(Presenca(a.lote_id, entrada, saidas[a.id]))
    return out


def cabeca_dias(pres: list[Presenca], inicio: date, fim: date, lote_id: Optional[int] = None) -> int:
    """Soma, dia a dia, das cabecas presentes entre inicio e fim (inclusivo).

    Ex.: 6 animais o periodo todo (181 dias) + 4 vendidos no dia 90 = 6x181 + 4x90 = 1446.
    lote_id restringe aos animais daquele lote.
    """
    if fim < inicio:
        return 0
    total = 0
    for p in pres:
        if lote_id is not None and p.lote_id != lote_id:
            continue
        ini = max(p.entrada, inicio) if p.entrada else inicio
        f = min(p.saida, fim) if p.saida else fim
        if f >= ini:
            total += (f - ini).days + 1
    return total


def rebanho_medio(pres: list[Presenca], inicio: date, fim: date, lote_id: Optional[int] = None) -> float:
    """Cabecas medias no periodo: o divisor certo para qualquer custo "por cabeca"."""
    dias = (fim - inicio).days + 1
    if dias <= 0:
        return 0.0
    return cabeca_dias(pres, inicio, fim, lote_id) / dias


# ── Custo nutricional ────────────────────────────────────────────────────────

class ItemNutricional(NamedTuple):
    custo: CustoNutricional
    inicio: date
    fim: date
    cabeca_dias: int
    valor: float


def custos_nutricionais_no_periodo(
    db: Session,
    user_id: int,
    inicio: date,
    fim: date,
    lote_id: Optional[int] = None,
    pres: Optional[list[Presenca]] = None,
) -> list[ItemNutricional]:
    """Custo de cada registro de nutricao no periodo: preco/kg x consumo/cab/dia x cabeca-dias.

    Conta as cabecas presentes em cada dia — inclusive as que foram vendidas ou morreram
    depois. Custo de um lote especifico usa as cabecas daquele lote; custo geral usa o
    rebanho todo, ou o lote em analise quando lote_id e informado.

    Unica fonte para Financeiro, resumo do contador e livro caixa.
    """
    q = db.query(CustoNutricional).filter(CustoNutricional.user_id == user_id)
    if lote_id is not None:
        q = q.filter((CustoNutricional.lote_id == lote_id) | (CustoNutricional.lote_id.is_(None)))
    if pres is None:
        pres = presencas(db, user_id)

    itens: list[ItemNutricional] = []
    for c in q.all():
        ini = max(c.data_inicio, inicio)
        f = min(c.data_fim or fim, fim)
        if f < ini:
            continue
        alvo = c.lote_id if c.lote_id is not None else lote_id
        cd = cabeca_dias(pres, ini, f, alvo)
        itens.append(ItemNutricional(c, ini, f, cd, (c.preco_kg or 0) * (c.consumo_kg_dia or 0) * cd))
    return itens


# ── Sanidade ─────────────────────────────────────────────────────────────────
# Dose atrasada fica pendente ate o reforco ser registrado ou o produtor dispensar o
# alerta (app/dispensas.py) — nao some sozinha com o tempo.

def _chave_dose(r) -> tuple:
    return (r.animal_id, r.tipo, (r.descricao or "").strip().lower())


def doses_pendentes(registros: list) -> list:
    """Registros de sanidade cuja proxima dose ainda esta em aberto.

    Vale so o registro MAIS RECENTE de cada (animal, tipo, descricao): aplicar o reforco cria
    um registro novo, que substitui o anterior. Sem isso, toda vacina ja reforcada apareceria
    atrasada para sempre. Se o mais recente nao tem proxima_data, nao ha nada pendente.
    """
    ultimo: dict = {}
    for r in registros:
        k = _chave_dose(r)
        atual = ultimo.get(k)
        if atual is None or (r.data, r.id) > (atual.data, atual.id):
            ultimo[k] = r
    return [r for r in ultimo.values() if r.proxima_data is not None]


def sanidade_pendente(
    db: Session, user_id: int, ate: date = date.max, dispensadas: bool = False,
) -> list[Saude]:
    """Doses pendentes dos animais ativos que vencem ate `ate` (inclusive as atrasadas).
    Ordenadas por vencimento; o animal vem na mesma query (sem N+1).

    dispensadas=False (padrao): tira as doses cujo alerta o produtor dispensou.
    dispensadas=True: devolve SO as dispensadas — para a lista de recuperacao da Agenda.

    Unica fonte para os alertas, o quadro da Dashboard, o e-mail, o filtro "vencendo" e a
    marcacao da tela de Saude.
    """
    ja = chaves_dispensadas(db, user_id)
    registros = (
        db.query(Saude)
        .join(Saude.animal)
        .options(contains_eager(Saude.animal))
        .filter(
            Animal.user_id == user_id,
            Animal.status == StatusEnum.ativo,
            Animal.deletado_em.is_(None),
        )
        .all()
    )
    pend = [
        r for r in doses_pendentes(registros)
        if r.proxima_data <= ate and (chave_dose(r.id) in ja) == dispensadas
    ]
    return sorted(pend, key=lambda r: (r.proxima_data, r.animal_id))


def agrupar_por_dose(pendentes: list) -> list[list]:
    """Junta a mesma dose com o mesmo vencimento: a vacinacao de um lote vira um item so,
    em vez de um por animal. Grupos em ordem de vencimento."""
    grupos: dict = {}
    for r in pendentes:
        k = (r.tipo, (r.descricao or "").strip().lower(), r.proxima_data)
        grupos.setdefault(k, []).append(r)
    return sorted(grupos.values(), key=lambda g: (g[0].proxima_data, -len(g)))
