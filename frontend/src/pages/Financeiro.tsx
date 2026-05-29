import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { AnaliseFinanceira, Lote } from '../services/api'
import { useToast } from '../components/Toast'
import { useEffect } from 'react'
import { formatBRL, formatNumber } from '../utils/format'

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

const fmt = (v: number | undefined | null, prefix = 'R$ ', decimals = 2) =>
  v != null ? (prefix === 'R$ ' ? formatBRL(v, decimals) : `${prefix}${formatNumber(v, decimals)}`) : '—'

const fmtNum = (v: number | undefined | null, suffix = '', decimals = 2) =>
  v != null ? `${formatNumber(v, decimals)}${suffix}` : '—'

export default function Financeiro() {
  const navigate = useNavigate()
  const { error: toastError } = useToast()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [data, setData] = useState<AnaliseFinanceira | null>(null)
  const [loading, setLoading] = useState(false)

  const hoje = new Date()
  const tresMesesAtras = new Date(hoje)
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3)

  const [filtro, setFiltro] = useState({
    data_inicio: tresMesesAtras.toISOString().split('T')[0],
    data_fim: hoje.toISOString().split('T')[0],
    lote_id: ''
  })

  useEffect(() => { api.get('/lotes').then(r => setLotes(r.data)) }, [])

  async function analisar() {
    setLoading(true)
    try {
      const params: any = { data_inicio: filtro.data_inicio, data_fim: filtro.data_fim }
      if (filtro.lote_id) params.lote_id = parseInt(filtro.lote_id)
      const r = await api.get('/financeiro/analise', { params })
      setData(r.data)
    } catch {
      toastError('Erro ao carregar analise financeira')
    } finally { setLoading(false) }
  }

  useEffect(() => { analisar() }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Analise Financeira</div>
          <div className="page-subtitle">Rentabilidade, custos e resultado do periodo</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate('/custos-nutricionais')}>Custos Nutri</button>
          <button className="btn btn-outline" onClick={() => navigate('/despesas-fixas')}>Despesas Fixas</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="filters-bar" style={{ gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label className="filter-label">Periodo:</label>
          <input className="form-input" type="date" style={{ width: 160 }} value={filtro.data_inicio}
            onChange={e => setFiltro(p => ({ ...p, data_inicio: e.target.value }))} />
          <span style={{ color: 'var(--gray-500)' }}>ate</span>
          <input className="form-input" type="date" style={{ width: 160 }} value={filtro.data_fim}
            onChange={e => setFiltro(p => ({ ...p, data_fim: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label className="filter-label">Lote:</label>
          <select className="form-select" style={{ width: 200 }} value={filtro.lote_id}
            onChange={e => setFiltro(p => ({ ...p, lote_id: e.target.value }))}>
            <option value="">Toda a fazenda</option>
            {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={analisar} disabled={loading}>
          {loading ? <><span className="spinner" /> Analisando...</> : 'Analisar'}
        </button>
      </div>

      {!data && !loading && (
        <div className="card card-padded" style={{ textAlign: 'center', padding: 48 }}>
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="var(--green-700)" strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>Selecione o periodo e clique em Analisar</div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--gray-500)', padding: 40 }}>
          <span className="spinner spinner-dark" /> Calculando analise financeira...
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPIs principais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KPI
              label="Lucro Liquido"
              value={fmt(data.lucro_liquido)}
              color={data.lucro_liquido >= 0 ? 'var(--green-700)' : 'var(--red-600)'}
            />
            <KPI
              label="Rentabilidade"
              value={fmtNum(data.rentabilidade_pct, '%')}
              color={data.rentabilidade_pct != null && data.rentabilidade_pct >= 0 ? 'var(--green-700)' : 'var(--red-600)'}
            />
            <KPI
              label="Custo / @ Produzida"
              value={fmt(data.custo_por_arroba_produzida)}
              color="var(--amber-600)"
            />
            <KPI
              label="Ganho / @"
              value={fmt(data.ganho_por_arroba)}
              color={data.ganho_por_arroba != null && data.ganho_por_arroba >= 0 ? 'var(--green-700)' : 'var(--red-600)'}
            />
          </div>

          {/* Info do periodo */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', background: 'var(--gray-50)', padding: '6px 14px', borderRadius: 'var(--radius)' }}>
              <strong>{data.qtd_cabecas}</strong> cabecas | <strong>{data.dias_periodo}</strong> dias | Rendimento carcaca: <strong>{data.rendimento_carcaca_pct}%</strong>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 20, marginBottom: 24 }}>
            {/* Custos */}
            <div className="card card-padded">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--red-100)' }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--red-600)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
                  </svg>
                </span>
                Custos no Periodo
              </h3>
              <MetricRow label="Custo Nutricional" value={fmt(data.custo_nutricional_total)} color="var(--amber-600)" />
              <MetricRow label="  por cabeca" value={fmt(data.custo_nutricional_por_cabeca)} />
              <MetricRow label="Custo Operacional" value={fmt(data.custo_operacional_total)} color="var(--amber-600)" />
              <MetricRow label="  por cabeca" value={fmt(data.custo_operacional_por_cabeca)} />
              <MetricRow label="Custo Saude" value={fmt(data.custo_saude_total)} color="var(--pink-600)" />
              <MetricRow label="Custo Total / Cabeca" value={fmt(data.custo_total_por_cabeca)} color="var(--red-600)" />
              <MetricRow label="Custo / @ Produzida" value={fmt(data.custo_por_arroba_produzida)} color="var(--red-600)" />
            </div>

            {/* Resultado */}
            <div className="card card-padded">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--green-100)' }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--green-700)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </span>
                Resultado Financeiro
              </h3>
              <MetricRow label="Receita Vendas" value={fmt(data.receita_vendas)} color="var(--green-700)" />
              <MetricRow label="Custo Compras" value={fmt(data.custo_compras)} color="var(--red-600)" />
              <MetricRow label="Lucro Bruto" value={fmt(data.lucro_bruto)} color={data.lucro_bruto >= 0 ? 'var(--green-700)' : 'var(--red-600)'} />
              <MetricRow label="Impostos" value={fmt(data.impostos)} color="var(--red-600)" />
              <MetricRow label="Lucro Liquido" value={fmt(data.lucro_liquido)} color={data.lucro_liquido >= 0 ? 'var(--green-700)' : 'var(--red-600)'} />
              <MetricRow label="Lucro Liq. s/ Agil (total)" value={fmt(data.lucro_liquido_sem_agil)} color={data.lucro_liquido_sem_agil != null && data.lucro_liquido_sem_agil >= 0 ? 'var(--green-700)' : 'var(--red-600)'} />
              <MetricRow label="Lucro Liq. s/ Agil (R$/cab)" value={fmt(data.lucro_liquido_sem_agil_por_cab)} color={data.lucro_liquido_sem_agil_por_cab != null && data.lucro_liquido_sem_agil_por_cab >= 0 ? 'var(--green-700)' : 'var(--red-600)'} />
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius)', background: data.rentabilidade_pct != null && data.rentabilidade_pct >= 0 ? 'var(--green-100)' : 'var(--red-100)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 2 }}>Rentabilidade</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: data.rentabilidade_pct != null && data.rentabilidade_pct >= 0 ? 'var(--green-700)' : 'var(--red-600)' }}>
                  {fmtNum(data.rentabilidade_pct, '%')}
                </div>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 20, marginBottom: 24 }}>
            {/* Arrobas */}
            <div className="card card-padded">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--blue-100)' }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--blue-600)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5 5 0 006.9 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.9 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V6"/>
                  </svg>
                </span>
                Arrobas (@)
              </h3>
              <MetricRow label="@ Entrada (total)" value={fmtNum(data.arrobas_entrada_total, ' @')} />
              <MetricRow label="@ Saida (total)" value={fmtNum(data.arrobas_saida_total, ' @')} />
              <MetricRow label="@ Produzidas" value={fmtNum(data.arrobas_produzidas_total, ' @')} color="var(--green-700)" />
              <MetricRow label="Ganho Periodo / @" value={fmtNum(data.ganho_periodo_arroba, ' @')} />
              <MetricRow label="Preco @ Compra (medio)" value={fmt(data.preco_arroba_compra_medio)} />
              <MetricRow label="Preco @ Venda (medio)" value={fmt(data.preco_arroba_venda_medio)} />
              <MetricRow label="Preco Medio Animal Compra" value={fmt(data.preco_medio_compra_animal)} />
              <MetricRow label="Preco Medio Animal Venda" value={fmt(data.preco_medio_venda_animal)} />
            </div>

            {/* Desempenho */}
            <div className="card card-padded">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--teal-100)' }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--teal-600)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                </span>
                Desempenho Zootecnico
              </h3>
              <MetricRow label="Peso Medio Inicial" value={fmtNum(data.peso_medio_inicial, ' kg', 1)} />
              <MetricRow label="Peso Medio Final" value={fmtNum(data.peso_medio_final, ' kg', 1)} />
              <MetricRow label="Peso Carcaca Medio" value={fmtNum(data.peso_carcaca_medio_final, ' kg', 1)} />
              <MetricRow label="Rendimento Carcaca" value={fmtNum(data.rendimento_carcaca_pct, '%', 1)} />
              <MetricRow label="GPD (kg/dia)" value={fmtNum(data.gpd_medio, ' kg', 3)} color={data.gpd_medio != null && data.gpd_medio > 0 ? 'var(--green-700)' : 'var(--red-600)'} />
              <MetricRow label="GMC (kg carcaca/dia)" value={fmtNum(data.gmc_medio, ' kg', 3)} color={data.gmc_medio != null && data.gmc_medio > 0 ? 'var(--green-700)' : 'var(--red-600)'} />
            </div>
          </div>

          {/* Dica se nao tem custos */}
          {data.custo_nutricional_total === 0 && data.custo_operacional_total === 0 && (
            <div className="alert alert-warning" style={{ marginTop: 8 }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              <div>
                <strong>Cadastre seus custos</strong> para ver a analise completa.{' '}
                <span onClick={() => navigate('/custos-nutricionais')} style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}>Custos Nutricionais</span>
                {' e '}
                <span onClick={() => navigate('/despesas-fixas')} style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}>Despesas Fixas</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
