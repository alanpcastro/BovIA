import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { Dashboard as DashboardData, AnaliseFinanceira, Alerta } from '../services/api'
import { useToast } from '../components/Toast'
import { formatBRL, formatNumber } from '../utils/format'
import { toLocalDate } from '../utils/date'

const fmt = (v: number | undefined | null) => v != null ? formatBRL(v) : '—'

const fmtCompact = (v: number | undefined | null) => {
  if (v == null) return '—'
  if (Math.abs(v) >= 1000) return `R$ ${formatNumber(v / 1000, 1)}k`
  return `R$ ${formatNumber(v, 0)}`
}

// ── Ícones SVG ────────────────────────────────────────────────────────────────
const IconScale = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5 5 0 006.9 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.9 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V6m0 16H9m3 0h3"/>
  </svg>
)
const IconCow = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
  </svg>
)
const IconHeart = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
  </svg>
)
const IconCash = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)
const IconMove = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
  </svg>
)
const IconWarn = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
  </svg>
)
const IconArrow = () => (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
  </svg>
)
const IconChart = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
  </svg>
)

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [fin, setFin] = useState<AnaliseFinanceira | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { error: toastError } = useToast()

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).catch(() => toastError('Erro ao carregar dashboard')).finally(() => setLoading(false))
    const hoje = new Date()
    const mesAtras = new Date(hoje); mesAtras.setMonth(mesAtras.getMonth() - 1)
    api.get('/financeiro/analise', {
      params: { data_inicio: toLocalDate(mesAtras), data_fim: toLocalDate(hoje) }
    }).then(r => setFin(r.data)).catch(() => {})
    api.get('/alertas').then(r => setAlertas(r.data)).catch(() => {})
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--gray-600)', padding: 60, fontSize: 18, justifyContent: 'center' }}>
      <span className="spinner spinner-dark" style={{ width: 24, height: 24 }} />
      Carregando...
    </div>
  )
  if (!data) return null

  const isNewUser = data.total_animais === 0

  const alertasAlta = alertas.filter(a => a.severidade === 'alta')
  const alertasMedia = alertas.filter(a => a.severidade === 'media')

  // ── Onboarding ────────────────────────────────────────────────────────────
  if (isNewUser) {
    const steps = [
      { num: 1, title: 'Crie seu primeiro lote', desc: 'Lotes organizam seus animais por pasto.', action: () => navigate('/lotes'), btn: 'Criar Lote' },
      { num: 2, title: 'Cadastre seus animais', desc: 'Registre brinco, raça, peso e lote.', action: () => navigate('/animais'), btn: 'Cadastrar' },
      { num: 3, title: 'Faça a primeira pesagem', desc: 'Acompanhe o ganho de peso (GMD).', action: () => navigate('/pesagens'), btn: 'Pesar' },
    ]
    return (
      <div>
        <div className="field-hero">
          <div>
            <div className="field-hero-label">Bem-vindo</div>
            <div className="field-hero-title">Vamos começar!</div>
            <div style={{ fontSize: 16, color: 'var(--green-400)', marginTop: 8 }}>Siga os 3 passos abaixo</div>
          </div>
        </div>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {steps.map(s => (
            <div key={s.num} className="card card-padded" style={{
              display: 'flex', gap: 22, alignItems: 'center', marginBottom: 16,
              borderLeft: '6px solid var(--green-700)',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 'var(--radius)',
                background: 'var(--green-100)', color: 'var(--green-800)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                fontSize: 28, fontWeight: 800,
              }}>{s.num}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--gray-900)' }}>{s.title}</div>
                <div style={{ fontSize: 15, color: 'var(--gray-600)', marginTop: 4 }}>{s.desc}</div>
              </div>
              <button className="btn btn-primary btn-xl" onClick={s.action}>{s.btn}</button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Dashboard normal ──────────────────────────────────────────────────────
  return (
    <div>
      {/* HERO: nome + total */}
      <div className="field-hero">
        <div>
          <div className="field-hero-title">Seu Rebanho</div>
        </div>
        <div className="field-hero-stats" style={{ display: 'flex', gap: 32 }}>
          <div className="field-hero-stat">
            <div className="field-hero-stat-num">{data.total_animais}</div>
            <div className="field-hero-stat-lbl">Animais</div>
          </div>
          <div className="field-hero-stat">
            <div className="field-hero-stat-num">{data.total_machos}</div>
            <div className="field-hero-stat-lbl">Machos</div>
          </div>
          <div className="field-hero-stat">
            <div className="field-hero-stat-num">{data.total_femeas}</div>
            <div className="field-hero-stat-lbl">Fêmeas</div>
          </div>
          {data.peso_medio_kg && (
            <div className="field-hero-stat">
              <div className="field-hero-stat-num">{Math.round(data.peso_medio_kg)}<span style={{ fontSize: 20 }}>kg</span></div>
              <div className="field-hero-stat-lbl">Peso Médio</div>
            </div>
          )}
        </div>
      </div>

      {/* ALERTAS CRÍTICOS — agenda consolidada */}
      {alertasAlta.length > 0 && (
        <div className="alert-big alert-urgent" onClick={() => navigate('/agenda')}>
          <div className="alert-big-icon"><IconWarn /></div>
          <div style={{ flex: 1 }}>
            <div className="alert-big-title">{alertasAlta.length} alerta(s) crítico(s)</div>
            <div className="alert-big-desc">
              {alertasAlta.slice(0, 3).map(a => a.titulo).join(' · ')}
              {alertasAlta.length > 3 && ` · +${alertasAlta.length - 3}`}
            </div>
          </div>
          <div className="alert-big-arrow"><IconArrow /></div>
        </div>
      )}
      {alertasAlta.length === 0 && alertasMedia.length > 0 && (
        <div
          className="card card-padded"
          onClick={() => navigate('/agenda')}
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--amber-600)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}
        >
          <div>
            <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{alertasMedia.length} alerta(s) de atenção</div>
            <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 2 }}>Toque para ver na Agenda</div>
          </div>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--gray-400)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      )}

      {/* AÇÕES PRINCIPAIS — tiles grandes */}
      <div className="section-title-big">O que você quer fazer?</div>
      <div className="action-grid">
        <button className="action-tile" onClick={() => navigate('/animais')}>
          <div className="action-tile-icon" style={{ background: 'var(--green-100)', color: 'var(--green-800)' }}><IconCow /></div>
          <div className="action-tile-label">Cadastrar Animal</div>
        </button>
        <button className="action-tile" onClick={() => navigate('/pesagens')}>
          <div className="action-tile-icon" style={{ background: 'var(--amber-100)', color: 'var(--amber-600)' }}><IconScale /></div>
          <div className="action-tile-label">Registrar Pesagem</div>
        </button>
        <button className="action-tile" onClick={() => navigate('/saude')}>
          <div className="action-tile-icon" style={{ background: 'var(--pink-100)', color: 'var(--pink-600)' }}><IconHeart /></div>
          <div className="action-tile-label">Vacinar</div>
        </button>
        <button className="action-tile" onClick={() => navigate('/movimentacoes')}>
          <div className="action-tile-icon" style={{ background: 'var(--blue-100)', color: 'var(--blue-600)' }}><IconMove /></div>
          <div className="action-tile-label">Comprar / Vender</div>
        </button>
        <button className="action-tile" onClick={() => navigate('/financeiro')}>
          <div className="action-tile-icon" style={{ background: 'var(--teal-100)', color: 'var(--teal-600)' }}><IconChart /></div>
          <div className="action-tile-label">Financeiro</div>
        </button>
      </div>

      {/* KPIs FINANCEIROS */}
      {fin && (
        <>
          <div className="section-title-big">Resultado do Mês</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div className="kpi-big">
              <div className="kpi-big-icon" style={{
                background: fin.lucro_liquido >= 0 ? 'var(--green-100)' : 'var(--red-100)',
                color: fin.lucro_liquido >= 0 ? 'var(--green-800)' : 'var(--red-600)',
              }}><IconCash /></div>
              <div>
                <div className="kpi-big-label">Lucro do Mês</div>
                <div className="kpi-big-value" style={{ color: fin.lucro_liquido >= 0 ? 'var(--green-800)' : 'var(--red-600)' }}>
                  {fmtCompact(fin.lucro_liquido)}
                </div>
              </div>
            </div>
            <div className="kpi-big">
              <div className="kpi-big-icon" style={{ background: 'var(--amber-100)', color: 'var(--amber-600)' }}><IconScale /></div>
              <div>
                <div className="kpi-big-label">Custo / @</div>
                <div className="kpi-big-value">{fin.custo_por_arroba_produzida != null ? fmt(fin.custo_por_arroba_produzida) : '—'}</div>
              </div>
            </div>
            <div className="kpi-big">
              <div className="kpi-big-icon" style={{
                background: fin.rentabilidade_pct != null && fin.rentabilidade_pct >= 0 ? 'var(--green-100)' : 'var(--red-100)',
                color: fin.rentabilidade_pct != null && fin.rentabilidade_pct >= 0 ? 'var(--green-800)' : 'var(--red-600)',
              }}><IconChart /></div>
              <div>
                <div className="kpi-big-label">Rentabilidade</div>
                <div className="kpi-big-value" style={{ color: fin.rentabilidade_pct != null && fin.rentabilidade_pct >= 0 ? 'var(--green-800)' : 'var(--red-600)' }}>
                  {fin.rentabilidade_pct != null ? `${fin.rentabilidade_pct}%` : '—'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* PRÓXIMAS VACINAS + PARTOS */}
      <div className="grid-2" style={{ gap: 20 }}>
        <div>
          <div className="section-title-big">
            <span style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: 8, background: 'var(--pink-100)', color: 'var(--pink-600)', alignItems: 'center', justifyContent: 'center' }}><IconHeart /></span>
            Próximas Vacinas
          </div>
          {data.proximas_vacinas.length === 0 ? (
            <div className="card card-padded" style={{ textAlign: 'center', padding: 32, color: 'var(--gray-600)', fontSize: 16 }}>
              Nenhuma vacina agendada
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table data-table-big">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th style={{ textAlign: 'right' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {data.proximas_vacinas.map(v => {
                    const dias = Math.ceil((new Date(v.proxima_data + 'T00:00').getTime() - Date.now()) / 86400000)
                    const urgente = dias <= 7
                    return (
                      <tr key={v.id} className="clickable" onClick={() => navigate(`/animais/${v.animal_id}`)}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{v.descricao}</div>
                          {urgente && <span className="badge badge-red" style={{ marginTop: 4, fontSize: 12, padding: '4px 10px' }}>Urgente — {dias}d</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: urgente ? 'var(--red-600)' : 'var(--amber-600)', fontSize: 16 }}>
                          {new Date(v.proxima_data + 'T00:00').toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="section-title-big">
            <span style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: 8, background: 'var(--green-100)', color: 'var(--green-800)', alignItems: 'center', justifyContent: 'center' }}><IconCow /></span>
            Partos Previstos
          </div>
          {data.partos_previstos.length === 0 ? (
            <div className="card card-padded" style={{ textAlign: 'center', padding: 32, color: 'var(--gray-600)', fontSize: 16 }}>
              Nenhum parto previsto
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table data-table-big">
                <thead>
                  <tr>
                    <th>Animal</th>
                    <th style={{ textAlign: 'right' }}>Previsão</th>
                  </tr>
                </thead>
                <tbody>
                  {data.partos_previstos.map(p => (
                    <tr key={p.id} className="clickable" onClick={() => navigate(`/animais/${p.animal_id}`)}>
                      <td>
                        <div style={{ fontWeight: 700 }}>Animal #{p.animal_id}</div>
                        {p.touro_brinco && <div style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 2 }}>Touro: #{p.touro_brinco}</div>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green-700)', fontSize: 16 }}>
                        {new Date(p.data_prevista_parto + 'T00:00').toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
