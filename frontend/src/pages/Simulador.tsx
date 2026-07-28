import { useState } from 'react'
import { formatBRL as fmtBRL, formatNumber as fmtNum } from '../utils/format'

interface SimulacaoInput {
  qtd_animais: number
  peso_compra_kg: number
  preco_arroba_compra: number
  peso_venda_kg: number
  preco_arroba_venda: number
  gmd_esperado: number
  rendimento_carcaca: number
  custo_diario_cab: number
  frete_compra: number
  frete_venda: number
  mortalidade_pct: number
  imposto_pct: number  // Funrural etc — % sobre receita bruta
}

interface SimulacaoResult {
  dias_confinamento: number
  ganho_peso_cab: number
  arrobas_entrada_cab: number
  arrobas_saida_cab: number
  arrobas_produzidas_cab: number
  arrobas_produzidas_total: number
  custo_compra_total: number
  custo_operacional_total: number
  custo_frete_total: number
  custo_total: number
  custo_por_arroba_produzida: number
  custo_por_cab: number
  receita_venda_total: number
  impostos_valor: number
  lucro_bruto: number
  lucro_liquido: number
  lucro_por_cab: number
  margem_pct: number
  break_even_arroba_venda: number
  break_even_peso_venda: number
  cab_efetivas: number
}

function calcular(input: SimulacaoInput): SimulacaoResult | null {
  const {
    qtd_animais, peso_compra_kg, preco_arroba_compra, peso_venda_kg,
    preco_arroba_venda, gmd_esperado, rendimento_carcaca, custo_diario_cab,
    frete_compra, frete_venda, mortalidade_pct, imposto_pct
  } = input

  if (qtd_animais <= 0 || peso_compra_kg <= 0 || peso_venda_kg <= peso_compra_kg || gmd_esperado <= 0) return null

  const ganho_peso_cab = peso_venda_kg - peso_compra_kg
  const dias_confinamento = Math.ceil(ganho_peso_cab / gmd_esperado)

  const rc = rendimento_carcaca / 100
  const arrobas_entrada_cab = (peso_compra_kg * rc) / 15
  const arrobas_saida_cab = (peso_venda_kg * rc) / 15
  const arrobas_produzidas_cab = arrobas_saida_cab - arrobas_entrada_cab

  const cab_efetivas = qtd_animais * (1 - mortalidade_pct / 100)

  const custo_compra_total = qtd_animais * arrobas_entrada_cab * preco_arroba_compra
  const custo_operacional_total = qtd_animais * custo_diario_cab * dias_confinamento
  const custo_frete_total = frete_compra + frete_venda
  const custo_total = custo_compra_total + custo_operacional_total + custo_frete_total

  const arrobas_produzidas_total = cab_efetivas * arrobas_produzidas_cab
  const custo_por_arroba_produzida = arrobas_produzidas_total > 0
    ? (custo_operacional_total + custo_frete_total) / arrobas_produzidas_total : 0

  const receita_venda_total = cab_efetivas * arrobas_saida_cab * preco_arroba_venda
  const lucro_bruto = receita_venda_total - custo_total
  const impostos_valor = receita_venda_total * (imposto_pct / 100)
  const lucro_liquido = lucro_bruto - impostos_valor
  const lucro_por_cab = cab_efetivas > 0 ? lucro_liquido / cab_efetivas : 0
  const margem_pct = receita_venda_total > 0 ? (lucro_liquido / receita_venda_total) * 100 : 0

  // Break-even = ponto onde lucro liquido = 0. Considera custo total (inclui compra) e impostos.
  // receita_necessaria = custo_total / (1 - imposto_pct/100)
  const fator_imposto = 1 - imposto_pct / 100
  const receita_break_even = fator_imposto > 0 ? custo_total / fator_imposto : custo_total
  const arrobas_saida_total = cab_efetivas * arrobas_saida_cab
  const break_even_arroba_venda = arrobas_saida_total > 0 ? receita_break_even / arrobas_saida_total : 0
  const break_even_peso_venda = (cab_efetivas > 0 && rc > 0 && preco_arroba_venda > 0)
    ? receita_break_even / (cab_efetivas * rc / 15 * preco_arroba_venda)
    : 0

  return {
    dias_confinamento, ganho_peso_cab,
    arrobas_entrada_cab, arrobas_saida_cab, arrobas_produzidas_cab,
    arrobas_produzidas_total,
    custo_compra_total, custo_operacional_total, custo_frete_total, custo_total,
    custo_por_arroba_produzida, custo_por_cab: custo_total / qtd_animais,
    receita_venda_total, impostos_valor,
    lucro_bruto, lucro_liquido, lucro_por_cab, margem_pct,
    break_even_arroba_venda, break_even_peso_venda,
    cab_efetivas,
  }
}


function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="card card-padded" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color || 'var(--gray-900)' }}>{value}</span>
    </div>
  )
}

function InputField({ label, value, onChange, suffix, step, min }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number; min?: number
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="form-input"
          type="number" inputMode="decimal"
          step={step || 0.01}
          min={min ?? 0}
          value={value || ''}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={suffix ? { paddingRight: 50 } : undefined}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--gray-400)', pointerEvents: 'none' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

const PRESETS = {
  confinamento: {
    label: 'Confinamento',
    values: { gmd_esperado: 1.5, rendimento_carcaca: 52, custo_diario_cab: 15, mortalidade_pct: 1 }
  },
  semiconfinamento: {
    label: 'Semiconfinamento',
    values: { gmd_esperado: 0.9, rendimento_carcaca: 52, custo_diario_cab: 8, mortalidade_pct: 1.5 }
  },
  pasto: {
    label: 'Pasto',
    values: { gmd_esperado: 0.5, rendimento_carcaca: 50, custo_diario_cab: 3, mortalidade_pct: 2 }
  },
}

export default function Simulador() {
  const [input, setInput] = useState<SimulacaoInput>({
    qtd_animais: 100,
    peso_compra_kg: 360,
    preco_arroba_compra: 310,
    peso_venda_kg: 540,
    preco_arroba_venda: 330,
    gmd_esperado: 1.5,
    rendimento_carcaca: 52,
    custo_diario_cab: 15,
    frete_compra: 3000,
    frete_venda: 3000,
    mortalidade_pct: 1,
    imposto_pct: 1.5,  // Funrural padrao
  })

  const [result, setResult] = useState<SimulacaoResult | null>(null)
  const [error, setError] = useState('')

  function update(field: keyof SimulacaoInput, value: number) {
    setInput(prev => ({ ...prev, [field]: value }))
  }

  function simular() {
    setError('')
    if (input.peso_venda_kg <= input.peso_compra_kg) {
      setError('Peso de venda deve ser maior que peso de compra')
      return
    }
    if (input.gmd_esperado <= 0) {
      setError('GMD deve ser maior que zero')
      return
    }
    const r = calcular(input)
    if (!r) {
      setError('Verifique os valores informados')
      return
    }
    setResult(r)
  }

  function aplicarPreset(key: keyof typeof PRESETS) {
    setInput(prev => ({ ...prev, ...PRESETS[key].values }))
  }

  function limpar() {
    setResult(null)
    setError('')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Simulador de Compra e Venda</div>
          <div className="page-subtitle">Projete cenarios e calcule a rentabilidade antes de decidir</div>
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--gray-500)', alignSelf: 'center', marginRight: 4 }}>Cenario:</span>
        {Object.entries(PRESETS).map(([key, preset]) => (
          <button
            key={key}
            className="btn btn-outline"
            style={{ fontSize: 13 }}
            onClick={() => aplicarPreset(key as keyof typeof PRESETS)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="simulador-grid">
        {/* Coluna Esquerda: Inputs */}
        <div>
          {/* Compra */}
          <div className="card card-padded" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--primary)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
              Compra
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <InputField label="Qtd animais" value={input.qtd_animais} onChange={v => update('qtd_animais', v)} suffix="cab" step={1} min={1} />
              <InputField label="Peso compra" value={input.peso_compra_kg} onChange={v => update('peso_compra_kg', v)} suffix="kg" />
              <InputField label="Preco/@ compra" value={input.preco_arroba_compra} onChange={v => update('preco_arroba_compra', v)} suffix="R$/@" />
              <InputField label="Frete compra" value={input.frete_compra} onChange={v => update('frete_compra', v)} suffix="R$" />
            </div>
          </div>

          {/* Venda */}
          <div className="card card-padded" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--success)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Venda
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <InputField label="Peso venda" value={input.peso_venda_kg} onChange={v => update('peso_venda_kg', v)} suffix="kg" />
              <InputField label="Preco/@ venda" value={input.preco_arroba_venda} onChange={v => update('preco_arroba_venda', v)} suffix="R$/@" />
              <InputField label="Frete venda" value={input.frete_venda} onChange={v => update('frete_venda', v)} suffix="R$" />
              <InputField label="Mortalidade" value={input.mortalidade_pct} onChange={v => update('mortalidade_pct', v)} suffix="%" />
              <InputField label="Imposto (Funrural)" value={input.imposto_pct} onChange={v => update('imposto_pct', v)} suffix="%" step={0.1} />
            </div>
          </div>

          {/* Operacao */}
          <div className="card card-padded" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--warning)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Operacao
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <InputField label="GMD esperado" value={input.gmd_esperado} onChange={v => update('gmd_esperado', v)} suffix="kg/dia" />
              <InputField label="Rend. carcaca" value={input.rendimento_carcaca} onChange={v => update('rendimento_carcaca', v)} suffix="%" />
              <div style={{ gridColumn: '1 / -1' }}>
                <InputField label="Custo diario/cab" value={input.custo_diario_cab} onChange={v => update('custo_diario_cab', v)} suffix="R$/dia" />
              </div>
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-xl" style={{ flex: 1 }} onClick={simular}>
              Simular
            </button>
            {result && (
              <button className="btn btn-outline" onClick={limpar}>Limpar</button>
            )}
          </div>
        </div>

        {/* Coluna Direita: Resultado */}
        <div>
          {!result && (
            <div className="card card-padded" style={{ textAlign: 'center', padding: 60, color: 'var(--gray-500)' }}>
              <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ margin: '0 auto 12px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <div style={{ fontWeight: 600 }}>Preencha os dados e clique em Simular</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Os calculos sao feitos localmente, sem enviar dados ao servidor</div>
            </div>
          )}

          {result && (
            <>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <KPI
                  label="Lucro Liquido"
                  value={fmtBRL(result.lucro_liquido)}
                  color={result.lucro_liquido >= 0 ? 'var(--success)' : 'var(--danger)'}
                  sub={`${fmtBRL(result.lucro_por_cab)}/cab`}
                />
                <KPI
                  label="Margem"
                  value={`${fmtNum(result.margem_pct, 1)}%`}
                  color={result.margem_pct >= 0 ? 'var(--success)' : 'var(--danger)'}
                  sub={`${result.dias_confinamento} dias`}
                />
                <KPI
                  label="@ Produzidas"
                  value={fmtNum(result.arrobas_produzidas_total, 1)}
                  color="var(--primary)"
                  sub={`${fmtNum(result.arrobas_produzidas_cab, 1)}@/cab`}
                />
                <KPI
                  label="Custo/@ Produzida"
                  value={fmtBRL(result.custo_por_arroba_produzida)}
                  color="var(--warning)"
                  sub={`Break-even: ${fmtBRL(result.break_even_arroba_venda)}/@`}
                />
              </div>

              {/* Detalhamento */}
              <div className="card card-padded" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 12 }}>Producao</div>
                <MetricRow label="Dias de confinamento" value={`${result.dias_confinamento} dias`} />
                <MetricRow label="Ganho de peso/cab" value={`${fmtNum(result.ganho_peso_cab, 1)} kg`} />
                <MetricRow label="@ entrada/cab" value={fmtNum(result.arrobas_entrada_cab, 2)} />
                <MetricRow label="@ saida/cab" value={fmtNum(result.arrobas_saida_cab, 2)} />
                <MetricRow label="@ produzidas/cab" value={fmtNum(result.arrobas_produzidas_cab, 2)} />
                <MetricRow label="Cab. efetivas (mortalidade)" value={fmtNum(result.cab_efetivas, 0)} />
              </div>

              <div className="card card-padded" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 12 }}>Custos</div>
                <MetricRow label="Compra dos animais" value={fmtBRL(result.custo_compra_total)} />
                <MetricRow label="Operacional (diarias)" value={fmtBRL(result.custo_operacional_total)} />
                <MetricRow label="Frete (compra + venda)" value={fmtBRL(result.custo_frete_total)} />
                <MetricRow label="Custo total" value={fmtBRL(result.custo_total)} color="var(--danger)" />
                <MetricRow label="Custo/cabeca" value={fmtBRL(result.custo_por_cab)} />
              </div>

              <div className="card card-padded">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 12 }}>Resultado</div>
                <MetricRow label="Receita de venda" value={fmtBRL(result.receita_venda_total)} color="var(--success)" />
                <MetricRow label="Custo total" value={fmtBRL(result.custo_total)} color="var(--danger)" />
                <MetricRow label="Lucro bruto" value={fmtBRL(result.lucro_bruto)} color={result.lucro_bruto >= 0 ? 'var(--success)' : 'var(--danger)'} />
                <MetricRow label={`Impostos (${input.imposto_pct}%)`} value={fmtBRL(result.impostos_valor)} color="var(--danger)" />
                <MetricRow label="Lucro líquido" value={fmtBRL(result.lucro_liquido)} color={result.lucro_liquido >= 0 ? 'var(--success)' : 'var(--danger)'} />
                <div style={{ borderTop: '2px solid var(--gray-200)', marginTop: 8, paddingTop: 8 }}>
                  <MetricRow label="Break-even @/venda" value={`${fmtBRL(result.break_even_arroba_venda)}/@`} color="var(--warning)" />
                  <MetricRow label="Peso minimo venda" value={`${fmtNum(result.break_even_peso_venda, 0)} kg`} color="var(--warning)" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
