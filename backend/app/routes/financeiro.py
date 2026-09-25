from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from typing import Optional
from datetime import date
from pydantic import BaseModel
from ..database import get_db
from ..models.animal import Animal
from ..models.lote import Lote
from ..models.pesagem import Pesagem
from ..models.movimentacao import Movimentacao
from ..models.saude import Saude
from ..models.despesa_fixa import DespesaFixa, CategoriaDespEnum
from ..auth import get_current_user
from ..models.user import User
from ..zootecnia import (
    referencia_de_ganho, presencas, rebanho_medio, custos_nutricionais_no_periodo,
)

router = APIRouter()


class AnaliseFinanceira(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    lote_id: Optional[int] = None
    qtd_cabecas: int                                   # plantel atual (base do desempenho zootecnico)
    cabecas_medias_periodo: Optional[float] = None     # rebanho medio no periodo (divisor dos custos por cabeca)
    dias_periodo: int

    # Peso
    peso_medio_inicial: Optional[float] = None
    peso_medio_final: Optional[float] = None
    gpd_medio: Optional[float] = None
    ganho_periodo_arroba: Optional[float] = None

    # Carcaça
    rendimento_carcaca_pct: float
    peso_carcaca_medio_final: Optional[float] = None
    gmc_medio: Optional[float] = None

    # Arrobas
    arrobas_entrada_total: Optional[float] = None
    arrobas_saida_total: Optional[float] = None
    arrobas_produzidas_total: Optional[float] = None

    # Custos
    custo_nutricional_total: float = 0
    custo_nutricional_por_cabeca: Optional[float] = None
    custo_operacional_total: float = 0
    custo_operacional_por_cabeca: Optional[float] = None
    custo_saude_total: float = 0
    custo_total_por_cabeca: Optional[float] = None
    custo_por_arroba_produzida: Optional[float] = None

    # Preços arroba
    preco_arroba_compra_medio: Optional[float] = None
    preco_arroba_venda_medio: Optional[float] = None
    ganho_por_arroba: Optional[float] = None

    # Resultado
    receita_vendas: float = 0
    custo_compras: float = 0
    lucro_bruto: float = 0
    impostos: float = 0
    lucro_liquido: float = 0
    rentabilidade_pct: Optional[float] = None

    # Preço por animal
    preco_medio_compra_animal: Optional[float] = None
    preco_medio_venda_animal: Optional[float] = None

    # Lucro sem ágio (comissão do intermediário). O nome do campo mantém a grafia antiga
    # para não quebrar frontends já publicados.
    lucro_liquido_sem_agil: Optional[float] = None
    lucro_liquido_sem_agil_por_cab: Optional[float] = None


def _overlap_days(rec_inicio: date, rec_fim: Optional[date], per_inicio: date, per_fim: date) -> int:
    """Calcula dias de sobreposição entre o registro e o período de análise."""
    start = max(rec_inicio, per_inicio)
    end = min(rec_fim or per_fim, per_fim)
    return max(0, (end - start).days + 1)


@router.get("/analise", response_model=AnaliseFinanceira)
def analise_financeira(
    data_inicio: date = Query(...),
    data_fim: date = Query(...),
    lote_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uid = current_user.id
    dias_periodo = (data_fim - data_inicio).days
    if dias_periodo <= 0:
        dias_periodo = 1

    # ── Animais ──────────────────────────────────────────────────────────────
    # Considera só animais ATIVOS no plantel atual. Vendidos/mortos saíram do rebanho
    # e não devem entrar no cálculo de desempenho zootécnico do periodo.
    q_animais = db.query(Animal).filter(
        Animal.user_id == uid,
        Animal.deletado_em == None,
        Animal.status == "ativo",
    )
    if lote_id:
        q_animais = q_animais.filter(Animal.lote_id == lote_id)
    animais = q_animais.all()
    qtd_cabecas = len(animais)
    animal_ids = [a.id for a in animais]

    # ── Rendimento de carcaça ────────────────────────────────────────────────
    rendimento = 52.0
    if lote_id:
        lote = db.query(Lote).filter(Lote.id == lote_id, Lote.user_id == uid).first()
        if lote and lote.rendimento_carcaca:
            rendimento = lote.rendimento_carcaca
    rend_frac = rendimento / 100.0

    # ── Pesos (primeira e última pesagem no período por animal) ───────────────
    pesos_iniciais = []
    pesos_finais = []
    gpds = []
    gmcs = []
    ganhos_arroba_por_animal = []  # so para animais com pi E pf no mesmo periodo
    arrobas_entrada = 0.0
    arrobas_saida = 0.0

    # Busca TODAS as pesagens do periodo numa unica query (evita N+1:
    # antes eram 2 queries por animal — 100 queries para 50 animais).
    pesagens_por_animal: dict[int, list] = {}
    if animal_ids:
        todas_pesagens = (
            db.query(Pesagem)
            .filter(
                Pesagem.animal_id.in_(animal_ids),
                Pesagem.data >= data_inicio,
                Pesagem.data <= data_fim,
            )
            .order_by(Pesagem.animal_id, Pesagem.data.asc())
            .all()
        )
        for p in todas_pesagens:
            pesagens_por_animal.setdefault(p.animal_id, []).append(p)

    # Quem tem só 1 pesagem no período mede o ganho a partir da pesagem ANTERIOR ao período
    # (a mesma regra da tela de Pesagens). Uma query para todos, sem N+1.
    anteriores: dict[int, Pesagem] = {}
    ids_uma_pesagem = [aid for aid, lista in pesagens_por_animal.items() if len(lista) == 1]
    if ids_uma_pesagem:
        sub_ant = (
            db.query(Pesagem.animal_id, sqlfunc.max(Pesagem.data).label("ultima"))
            .filter(Pesagem.animal_id.in_(ids_uma_pesagem), Pesagem.data < data_inicio)
            .group_by(Pesagem.animal_id)
            .subquery()
        )
        for p in db.query(Pesagem).join(
            sub_ant, (Pesagem.animal_id == sub_ant.c.animal_id) & (Pesagem.data == sub_ant.c.ultima)
        ).all():
            anteriores[p.animal_id] = p

    for animal in animais:
        lista = pesagens_por_animal.get(animal.id, [])
        primeira = lista[0] if lista else None
        ultima = lista[-1] if lista else None

        # Define pi/pf e suas datas
        # Caso 1: 2+ pesagens no período — usa as pesagens como pontas
        # Caso 2: 1 pesagem no período — ponto de partida = pesagem anterior ao período ou,
        #         sem ela, a entrada do animal (zootecnia.referencia_de_ganho — mesma regra
        #         do GMD da tela de Pesagens; NUNCA data_nascimento)
        # Caso 3: 0 pesagens — fallback pra peso_entrada como inicial, sem final
        pi = None
        pf = None
        data_pi = None
        data_pf = None

        if len(lista) >= 2:
            pi = primeira.peso_kg
            data_pi = primeira.data
            pf = ultima.peso_kg
            data_pf = ultima.data
        elif primeira:
            ref = referencia_de_ganho(animal, anteriores.get(animal.id))
            if ref:
                pi, data_pi = ref
            else:
                # Sem nenhuma referência anterior: não dá pra medir ganho
                pi, data_pi = primeira.peso_kg, primeira.data
            pf = primeira.peso_kg
            data_pf = primeira.data
        elif animal.peso_entrada is not None:
            # Sem pesagem no período: só temos o peso de cadastro
            pi = animal.peso_entrada

        if pi is not None:
            pesos_iniciais.append(pi)
            arrobas_entrada += (pi * rend_frac) / 15.0
        if pf is not None:
            pesos_finais.append(pf)
            arrobas_saida += (pf * rend_frac) / 15.0

        # Ganho em @ por animal: requer pi E pf no periodo (independente das datas)
        if pi is not None and pf is not None:
            ganhos_arroba_por_animal.append((pf - pi) * rend_frac / 15.0)

        if pi is not None and pf is not None and data_pi is not None and data_pf is not None:
            dias_animal = (data_pf - data_pi).days
            if dias_animal > 0:
                gpds.append((pf - pi) / dias_animal)
                carcaca_ini = pi * rend_frac
                carcaca_fim = pf * rend_frac
                gmcs.append((carcaca_fim - carcaca_ini) / dias_animal)

    peso_medio_inicial = round(sum(pesos_iniciais) / len(pesos_iniciais), 1) if pesos_iniciais else None
    peso_medio_final = round(sum(pesos_finais) / len(pesos_finais), 1) if pesos_finais else None
    gpd_medio = round(sum(gpds) / len(gpds), 3) if gpds else None
    gmc_medio = round(sum(gmcs) / len(gmcs), 3) if gmcs else None
    arrobas_produzidas = round(arrobas_saida - arrobas_entrada, 2) if pesos_iniciais and pesos_finais else None

    # Ganho em @ medio por animal (so considera animais com pi E pf no periodo)
    ganho_periodo_arroba = (
        round(sum(ganhos_arroba_por_animal) / len(ganhos_arroba_por_animal), 2)
        if ganhos_arroba_por_animal else None
    )

    peso_carcaca_medio_final = round(peso_medio_final * rend_frac, 1) if peso_medio_final else None

    # ── Rebanho médio no período ─────────────────────────────────────────────
    # Custos "por cabeça" dividem pelas cabeças que estavam na fazenda em cada dia do
    # período, não pelo plantel de hoje: quem foi vendido em março comeu até março.
    pres = presencas(db, uid)
    cabecas_medias = rebanho_medio(pres, data_inicio, data_fim, lote_id or None)

    def _por_cabeca(valor: float) -> Optional[float]:
        return round(valor / cabecas_medias, 2) if cabecas_medias > 0 else None

    # ── Custo Nutricional ────────────────────────────────────────────────────
    # Mesma função do resumo do contador e do livro caixa (zootecnia.py).
    custo_nutri_total = round(sum(
        i.valor for i in custos_nutricionais_no_periodo(db, uid, data_inicio, data_fim, lote_id or None, pres)
    ), 2)
    custo_nutri_por_cab = _por_cabeca(custo_nutri_total)

    # ── Custo Operacional (despesas fixas exceto impostos) ────────────────────
    despesas = db.query(DespesaFixa).filter(DespesaFixa.user_id == uid).all()

    custo_oper_total = 0.0
    impostos_total = 0.0
    for d in despesas:
        dias = _overlap_days(d.data_inicio, d.data_fim, data_inicio, data_fim)
        if dias > 0:
            valor_periodo = (d.valor_mensal / 30.0) * dias
            if d.categoria == CategoriaDespEnum.impostos:
                impostos_total += valor_periodo
            else:
                custo_oper_total += valor_periodo

    custo_oper_total = round(custo_oper_total, 2)
    impostos_total = round(impostos_total, 2)
    custo_oper_por_cab = _por_cabeca(custo_oper_total)

    # ── Custo Saúde ──────────────────────────────────────────────────────────
    q_saude = db.query(sqlfunc.coalesce(sqlfunc.sum(Saude.custo), 0)).join(Animal).filter(
        Animal.user_id == uid,
        Saude.data >= data_inicio,
        Saude.data <= data_fim,
    )
    if lote_id:
        q_saude = q_saude.filter(Animal.lote_id == lote_id)
    custo_saude = round(float(q_saude.scalar()), 2)

    # ── Custos totais ────────────────────────────────────────────────────────
    custo_total = custo_nutri_total + custo_oper_total + custo_saude
    custo_total_por_cab = _por_cabeca(custo_total)

    custo_por_arroba = None
    if arrobas_produzidas and arrobas_produzidas > 0:
        custo_por_arroba = round(custo_total / arrobas_produzidas, 2)

    # ── Movimentações financeiras ────────────────────────────────────────────
    # Considera TODAS as movimentações do período — NÃO só as de animais ativos.
    # Quando um animal é vendido/morre, o status deixa de ser "ativo", mas a compra e a
    # venda dele continuam sendo fatos financeiros do período e precisam contar. (Antes,
    # filtrar por animais ativos fazia custo de compra e receita de venda de vendidos
    # sumirem da análise.)
    q_mov = db.query(Movimentacao).filter(
        Movimentacao.user_id == uid,
        Movimentacao.data >= data_inicio,
        Movimentacao.data <= data_fim,
    )
    if lote_id:
        # Restringe às movimentações dos animais desse lote, mesmo os já vendidos
        q_mov = q_mov.join(Animal).filter(Animal.lote_id == lote_id)
    movs = q_mov.all()

    # Receita de vendas: valor menos desconto concedido
    receita_vendas = sum((m.valor or 0) - (m.desconto or 0) for m in movs if m.tipo == "venda")
    # Custo de compras: valor mais frete pago
    custo_compras = sum((m.valor or 0) + (m.frete or 0) for m in movs if m.tipo == "compra")
    receita_vendas = round(receita_vendas, 2)
    custo_compras = round(custo_compras, 2)

    vendas_com_arroba = [m for m in movs if m.tipo == "venda" and m.preco_arroba]
    compras_com_arroba = [m for m in movs if m.tipo == "compra" and m.preco_arroba]

    preco_arroba_venda = round(
        sum(m.preco_arroba for m in vendas_com_arroba) / len(vendas_com_arroba), 2
    ) if vendas_com_arroba else None
    preco_arroba_compra = round(
        sum(m.preco_arroba for m in compras_com_arroba) / len(compras_com_arroba), 2
    ) if compras_com_arroba else None

    ganho_por_arroba = None
    if preco_arroba_venda is not None and custo_por_arroba is not None:
        ganho_por_arroba = round(preco_arroba_venda - custo_por_arroba, 2)

    # Preço médio por animal
    vendas_com_valor = [m for m in movs if m.tipo == "venda" and m.valor]
    compras_com_valor = [m for m in movs if m.tipo == "compra" and m.valor]
    preco_medio_venda_animal = round(
        sum(m.valor for m in vendas_com_valor) / len(vendas_com_valor), 2
    ) if vendas_com_valor else None
    preco_medio_compra_animal = round(
        sum(m.valor for m in compras_com_valor) / len(compras_com_valor), 2
    ) if compras_com_valor else None

    # ── Ágio (comissão de intermediário) ─────────────────────────────────────
    total_agio = sum(m.agio_compra or 0 for m in movs if m.tipo == "compra")
    total_agio = round(total_agio, 2)

    # ── Resultado ────────────────────────────────────────────────────────────
    lucro_bruto = round(receita_vendas - custo_compras - custo_total, 2)
    lucro_liquido = round(lucro_bruto - impostos_total, 2)

    # Lucro líquido sem ágio: o que teria sobrado sem pagar a comissão do intermediário.
    # O ágio já está dentro do valor da compra (o formulário diz isso), então a ÚNICA
    # diferença para o lucro líquido é devolvê-lo — ração, saúde e impostos continuam.
    # (Antes subtraía só o custo operacional e esquecia nutrição, saúde e impostos.)
    lucro_liq_sem_agil = round(lucro_liquido + total_agio, 2)
    lucro_liq_sem_agil_por_cab = _por_cabeca(lucro_liq_sem_agil)

    rentabilidade = None
    investimento = custo_compras + custo_total
    if investimento > 0:
        rentabilidade = round((lucro_liquido / investimento) * 100, 2)

    return AnaliseFinanceira(
        periodo_inicio=data_inicio,
        periodo_fim=data_fim,
        lote_id=lote_id,
        qtd_cabecas=qtd_cabecas,
        cabecas_medias_periodo=round(cabecas_medias, 2),
        dias_periodo=dias_periodo,
        peso_medio_inicial=peso_medio_inicial,
        peso_medio_final=peso_medio_final,
        gpd_medio=gpd_medio,
        ganho_periodo_arroba=ganho_periodo_arroba,
        rendimento_carcaca_pct=rendimento,
        peso_carcaca_medio_final=peso_carcaca_medio_final,
        gmc_medio=gmc_medio,
        arrobas_entrada_total=round(arrobas_entrada, 2) if pesos_iniciais else None,
        arrobas_saida_total=round(arrobas_saida, 2) if pesos_finais else None,
        arrobas_produzidas_total=arrobas_produzidas,
        custo_nutricional_total=custo_nutri_total,
        custo_nutricional_por_cabeca=custo_nutri_por_cab,
        custo_operacional_total=custo_oper_total,
        custo_operacional_por_cabeca=custo_oper_por_cab,
        custo_saude_total=custo_saude,
        custo_total_por_cabeca=custo_total_por_cab,
        custo_por_arroba_produzida=custo_por_arroba,
        preco_arroba_compra_medio=preco_arroba_compra,
        preco_arroba_venda_medio=preco_arroba_venda,
        ganho_por_arroba=ganho_por_arroba,
        receita_vendas=receita_vendas,
        custo_compras=custo_compras,
        lucro_bruto=lucro_bruto,
        impostos=impostos_total,
        lucro_liquido=lucro_liquido,
        rentabilidade_pct=rentabilidade,
        preco_medio_compra_animal=preco_medio_compra_animal,
        preco_medio_venda_animal=preco_medio_venda_animal,
        lucro_liquido_sem_agil=lucro_liq_sem_agil,
        lucro_liquido_sem_agil_por_cab=lucro_liq_sem_agil_por_cab,
    )
