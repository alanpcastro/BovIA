"""Regras de rebanho compartilhadas (app/zootecnia.py).

Rodar de backend/:  venv/bin/python -m pytest
"""
from datetime import date, datetime
from types import SimpleNamespace

from app.zootecnia import (
    Presenca, cabeca_dias, gmd_entre, ponto_de_entrada, rebanho_medio, referencia_de_ganho,
)

D = date.fromisoformat


def animal(**kw):
    base = dict(peso_entrada=300.0, data_entrada=None, data_nascimento=None,
                created_at=datetime(2026, 9, 24, 10, 0))
    return SimpleNamespace(**{**base, **kw})


# ── Ganho de peso (C5) ───────────────────────────────────────────────────────

def test_entrada_usa_data_de_entrada_e_nunca_a_de_nascimento():
    # Boi que nasceu em 2024 e foi comprado em jan/2026: o ganho conta da compra.
    a = animal(data_entrada=D("2026-01-01"), data_nascimento=D("2024-01-01"))
    assert ponto_de_entrada(a) == (300.0, D("2026-01-01"))


def test_entrada_sem_data_informada_cai_na_data_de_cadastro():
    a = animal(data_nascimento=D("2024-01-01"))
    assert ponto_de_entrada(a) == (300.0, D("2026-09-24"))


def test_sem_peso_de_entrada_nao_ha_referencia():
    assert ponto_de_entrada(animal(peso_entrada=None, data_entrada=D("2026-01-01"))) is None


def test_pesagem_anterior_vence_a_entrada():
    a = animal(data_entrada=D("2026-01-01"))
    anterior = SimpleNamespace(peso_kg=330.0, data=D("2026-02-01"))
    assert referencia_de_ganho(a, anterior) == (330.0, D("2026-02-01"))
    assert referencia_de_ganho(a, None) == (300.0, D("2026-01-01"))


def test_gmd_entre():
    assert round(gmd_entre(330.0, D("2026-02-01"), 380.0, D("2026-05-15")), 3) == 0.485
    assert gmd_entre(330.0, D("2026-02-01"), 380.0, D("2026-02-01")) is None  # mesmo dia
    assert gmd_entre(330.0, D("2026-05-15"), 380.0, D("2026-02-01")) is None  # invertido


# ── Presenca no rebanho (C3) ─────────────────────────────────────────────────

JAN, JUN = D("2026-01-01"), D("2026-06-30")  # 181 dias


def test_vendido_conta_ate_o_dia_da_venda():
    # 6 o semestre todo + 4 vendidos em 31/03 (90 dias) = 6x181 + 4x90
    pres = [Presenca(1, JAN, None)] * 6 + [Presenca(None, JAN, D("2026-03-31"))] * 4
    assert cabeca_dias(pres, JAN, JUN) == 1446
    assert round(rebanho_medio(pres, JAN, JUN), 2) == 7.99
    # Depois da venda, so os 6 ficam
    assert rebanho_medio(pres, D("2026-04-01"), JUN) == 6.0


def test_sem_data_de_entrada_conta_desde_o_inicio_e_nascido_depois_nao():
    pres = [
        Presenca(None, None, None),              # cadastrado sem data: presente o periodo todo
        Presenca(None, D("2026-06-21"), None),   # nasceu em 21/06: 10 dias
        Presenca(None, D("2026-07-10"), None),   # nasceu depois do periodo: 0
    ]
    assert cabeca_dias(pres, JAN, JUN) == 181 + 10


def test_filtro_por_lote():
    pres = [Presenca(1, JAN, None), Presenca(2, JAN, None), Presenca(None, JAN, D("2026-01-10"))]
    assert cabeca_dias(pres, JAN, JUN, lote_id=1) == 181
    assert cabeca_dias(pres, JAN, JUN) == 181 + 181 + 10
    assert cabeca_dias(pres, JUN, JAN) == 0  # periodo invertido


# ── Sanidade (C2) ────────────────────────────────────────────────────────────

from app.zootecnia import agrupar_por_dose, doses_pendentes  # noqa: E402


def dose(id, animal_id, data, proxima, descricao="Aftosa", tipo="vacinacao"):
    return SimpleNamespace(id=id, animal_id=animal_id, tipo=tipo, descricao=descricao,
                           data=D(data), proxima_data=D(proxima) if proxima else None)


def test_reforco_aplicado_substitui_a_dose_anterior():
    # Sem essa regra, a dose de julho apareceria "atrasada" para sempre
    regs = [dose(1, 7, "2026-01-10", "2026-07-10"), dose(2, 7, "2026-07-12", "2027-01-12")]
    assert [r.id for r in doses_pendentes(regs)] == [2]


def test_reforco_sem_proxima_data_encerra_a_pendencia():
    # Descricao com caixa e espacos diferentes ainda e a mesma vacina
    regs = [dose(1, 7, "2026-01-10", "2026-07-10", " aftosa "), dose(2, 7, "2026-07-11", None, "AFTOSA")]
    assert doses_pendentes(regs) == []


def test_vacinas_e_animais_diferentes_nao_se_substituem():
    regs = [
        dose(1, 7, "2026-01-10", "2026-07-10"),
        dose(2, 7, "2026-08-01", "2026-10-01", "Brucelose"),                  # outra vacina
        dose(3, 7, "2026-08-01", "2026-10-01", "Aftosa", tipo="vermifugacao"),  # outro tipo
        dose(4, 8, "2026-08-01", "2027-02-01"),                                # outro animal
    ]
    assert sorted(r.id for r in doses_pendentes(regs)) == [1, 2, 3, 4]


def test_vacinacao_de_um_lote_vira_um_grupo():
    regs = [dose(i, 100 + i, "2026-05-28", "2026-06-28", "febre aftosa") for i in range(50)]
    regs.append(dose(99, 999, "2026-09-01", "2026-10-01", "Ivermectina", tipo="vermifugacao"))
    grupos = agrupar_por_dose(regs)
    assert [len(g) for g in grupos] == [50, 1]  # em ordem de vencimento
