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
from ..models.custo_nutricional import CustoNutricional
from ..models.despesa_fixa import DespesaFixa, CategoriaDespEnum
from ..auth import get_current_user
from ..models.user import User

router = APIRouter()


class AnaliseFinanceira(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    lote_id: Optional[int] = None
    qtd_cabecas: int
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
    custo_nutricional_por_cabeca: float = 0
    custo_operacional_total: float = 0
    custo_operacional_por_cabeca: float = 0
    custo_saude_total: float = 0
    custo_total_por_cabeca: float = 0
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

    # Lucro sem ágil
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
    q_animais = db.query(Animal).filter(
        Animal.user_id == uid, Animal.deletado_em == None
    )
    if lote_id:
        q_animais = q_animais.filter(Animal.lote_id == lote_id)
    animais = q_animais.all()
    qtd_cabecas = len(animais) or 1  # evitar divisão por zero
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
    arrobas_entrada = 0.0
    arrobas_saida = 0.0

    for animal in animais:
        primeira = (
            db.query(Pesagem)
            .filter(Pesagem.animal_id == animal.id, Pesagem.data >= data_inicio, Pesagem.data <= data_fim)
            .order_by(Pesagem.data.asc())
            .first()
        )
        ultima = (
            db.query(Pesagem)
            .filter(Pesagem.animal_id == animal.id, Pesagem.data >= data_inicio, Pesagem.data <= data_fim)
            .order_by(Pesagem.data.desc())
            .first()
        )

        pi = primeira.peso_kg if primeira else (animal.peso_entrada if animal.peso_entrada else None)
        pf = ultima.peso_kg if ultima else None

        if pi is not None:
            pesos_iniciais.append(pi)
            arrobas_entrada += (pi * rend_frac) / 15.0
        if pf is not None:
            pesos_finais.append(pf)
            arrobas_saida += (pf * rend_frac) / 15.0

        if pi is not None and pf is not None and primeira and ultima:
            dias_animal = (ultima.data - primeira.data).days
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

    ganho_periodo_arroba = None
    if peso_medio_inicial is not None and peso_medio_final is not None:
        ganho_periodo_arroba = round((peso_medio_final - peso_medio_inicial) / 30.0, 2)

    peso_carcaca_medio_final = round(peso_medio_final * rend_frac, 1) if peso_medio_final else None

    # ── Custo Nutricional ────────────────────────────────────────────────────
    q_nutri = db.query(CustoNutricional).filter(CustoNutricional.user_id == uid)
    if lote_id:
        q_nutri = q_nutri.filter(
            (CustoNutricional.lote_id == lote_id) | (CustoNutricional.lote_id == None)
        )
    custos_nutri = q_nutri.all()

    custo_nutri_total = 0.0
    for c in custos_nutri:
        dias = _overlap_days(c.data_inicio, c.data_fim, data_inicio, data_fim)
        if dias > 0:
            # Se o custo é de um lote específico, contar só animais desse lote
            if c.lote_id:
                n = db.query(sqlfunc.count(Animal.id)).filter(
                    Animal.lote_id == c.lote_id, Animal.user_id == uid, Animal.deletado_em == None
                ).scalar() or 1
            else:
                n = qtd_cabecas
            custo_nutri_total += c.preco_kg * c.consumo_kg_dia * dias * n

    custo_nutri_total = round(custo_nutri_total, 2)
    custo_nutri_por_cab = round(custo_nutri_total / qtd_cabecas, 2)

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
    custo_oper_por_cab = round(custo_oper_total / qtd_cabecas, 2)

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
    custo_total_por_cab = round(custo_total / qtd_cabecas, 2)

    custo_por_arroba = None
    if arrobas_produzidas and arrobas_produzidas > 0:
        custo_por_arroba = round(custo_total / arrobas_produzidas, 2)

    # ── Movimentações financeiras ────────────────────────────────────────────
    q_mov = db.query(Movimentacao).filter(
        Movimentacao.user_id == uid,
        Movimentacao.data >= data_inicio,
        Movimentacao.data <= data_fim,
    )
    if animal_ids:
        q_mov = q_mov.filter(Movimentacao.animal_id.in_(animal_ids))
    movs = q_mov.all()

    receita_vendas = sum(m.valor or 0 for m in movs if m.tipo == "venda")
    custo_compras = sum(m.valor or 0 for m in movs if m.tipo == "compra")
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

    # ── Ágil (comissão de intermediário) ────────────────────────────────────
    total_agio = sum(m.agio_compra or 0 for m in movs if m.tipo == "compra")
    total_agio = round(total_agio, 2)

    # ── Resultado ────────────────────────────────────────────────────────────
    lucro_bruto = round(receita_vendas - custo_compras - custo_total, 2)
    lucro_liquido = round(lucro_bruto - impostos_total, 2)

    # Lucro líquido sem ágil: desconsidera comissão do intermediário
    # = valor_venda - (valor_compra - agio) - custo_operacional
    custo_compras_sem_agil = custo_compras - total_agio
    lucro_liq_sem_agil = round(receita_vendas - custo_compras_sem_agil - custo_oper_total, 2)
    lucro_liq_sem_agil_por_cab = round(lucro_liq_sem_agil / qtd_cabecas, 2)

    rentabilidade = None
    investimento = custo_compras + custo_total
    if investimento > 0:
        rentabilidade = round((lucro_liquido / investimento) * 100, 2)

    return AnaliseFinanceira(
        periodo_inicio=data_inicio,
        periodo_fim=data_fim,
        lote_id=lote_id,
        qtd_cabecas=len(animais),
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
