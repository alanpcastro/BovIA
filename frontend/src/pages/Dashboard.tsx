import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { Dashboard as DashboardData, AnaliseFinanceira } from '../services/api'
import { useToast } from '../components/Toast'

function StatCard({ label, value, sub, color, bg, icon }: {
  label: string; value: string | number; sub?: string; color: string; bg: string; icon: React.ReactNode
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: bg }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">{value}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
    </div>
  )
}

const fmt = (v: number | undefined | null) =>
  v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [fin, setFin] = useState<AnaliseFinanceira | null>(null)
  const [loading, setLoading] = useState(true)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()

  async function enviarAlertas() {
    setEnviandoEmail(true)
    try {
      const r = await api.post('/dashboard/alertas/email')
      success(r.data.message)
    } catch {
      toastError('Erro ao enviar alertas. Verifique as configurações de email no .env')
    } finally {
      setEnviandoEmail(false)
    }
  }

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false))
    // Financial summary — last 30 days
    const hoje = new Date()
    const mesAtras = new Date(hoje)
    mesAtras.setMonth(mesAtras.getMonth() - 1)
    api.get('/financeiro/analise', {
      params: { data_inicio: mesAtras.toISOString().split('T')[0], data_fim: hoje.toISOString().split('T')[0] }
    }).then(r => setFin(r.data)).catch(() => {})
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--gray-400)', padding: 40 }}>
      <span className="spinner spinner-dark" />
      Carregando dashboard...
    </div>
  )
  if (!data) return null

  const isNewUser = data.total_animais === 0

  const vacinasUrgentes = data.proximas_vacinas.filter(v => {
    const dias = Math.ceil((new Date(v.proxima_data + 'T00:00').getTime() - Date.now()) / 86400000)
    return dias <= 7
  })

  // Onboarding wizard for new users
  if (isNewUser) {
    const steps = [
      {
        num: 1, title: 'Crie seu primeiro lote',
        desc: 'Lotes organizam seus animais por pasto, fase ou finalidade.',
        action: () => navigate('/lotes'), btn: 'Criar Lote',
        icon: <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--green-700)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4M3 7v10l9 4m0-14v14m9-10v10l-9 4" /></svg>,
      },
      {
        num: 2, title: 'Cadastre animais',
        desc: 'Registre seus animais com brinco, raca, peso de entrada e lote.',
        action: () => navigate('/animais'), btn: 'Cadastrar Animais',
        icon: <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--green-700)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>,
      },
      {
        num: 3, title: 'Registre a primeira pesagem',
        desc: 'Pesagens permitem acompanhar ganho de peso e GMD.',
        action: () => navigate('/pesagens'), btn: 'Registrar Pesagem',
        icon: <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--green-700)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5 5 0 006.9 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.9 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V6m0 16H9m3 0h3" /></svg>,
      },
    ]

    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Bem-vindo ao BovIA!</div>
            <div className="page-subtitle">Siga os passos abaixo para comecar</div>
          </div>
        </div>

        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {steps.map((s, i) => (
            <div key={s.num} className="card card-padded" style={{
              display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16,
              borderLeft: '4px solid var(--green-600)',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 'var(--radius)',
                background: 'var(--green-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {s.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Passo {s.num}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)', marginTop: 2 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>{s.desc}</div>
              </div>
              <button className="btn btn-primary" onClick={s.action} style={{ flexShrink: 0 }}>
                {s.btn}
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Visão geral do seu rebanho</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={enviarAlertas} disabled={enviandoEmail} title="Enviar alertas de vacinação por email">
            {enviandoEmail ? <><span className="spinner" /> Enviando...</> : '📧 Alertas'}
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/animais')}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Novo Animal
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/pesagens')}>
            Registrar Pesagem
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard
          label="Total de Animais"
          value={data.total_animais}
          sub="rebanho ativo"
          color="var(--green-800)"
          bg="var(--green-100)"
          icon={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>}
        />
        <StatCard
          label="Machos"
          value={data.total_machos}
          color="var(--blue-600)"
          bg="var(--blue-100)"
          icon={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="10" cy="14" r="5"/><path strokeLinecap="round" strokeLinejoin="round" d="M19 5l-5.2 5.2M19 5h-5m5 0v5"/></svg>}
        />
        <StatCard
          label="Fêmeas"
          value={data.total_femeas}
          color="var(--pink-600)"
          bg="var(--pink-100)"
          icon={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="9" r="5"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 14v6m-3-3h6"/></svg>}
        />
        <StatCard
          label="Peso Médio"
          value={data.peso_medio_kg ? `${data.peso_medio_kg} kg` : '—'}
          sub={data.peso_medio_kg ? `${(data.peso_medio_kg * 0.52 / 15).toFixed(1)} @` : undefined}
          color="var(--amber-600)"
          bg="var(--amber-100)"
          icon={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5 5 0 006.9 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.9 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V6m0 16H9m3 0h3"/></svg>}
        />
      </div>

      {/* Resumo Financeiro (último mês) */}
      {fin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          <StatCard
            label="Lucro do Mês"
            value={fmt(fin.lucro_liquido)}
            color={fin.lucro_liquido >= 0 ? 'var(--green-800)' : 'var(--red-600)'}
            bg={fin.lucro_liquido >= 0 ? 'var(--green-100)' : 'var(--red-100)'}
            icon={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          />
          <StatCard
            label="Custo / @"
            value={fin.custo_por_arroba_produzida != null ? fmt(fin.custo_por_arroba_produzida) : '—'}
            color="var(--amber-600)"
            bg="var(--amber-100)"
            icon={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg>}
          />
          <StatCard
            label="Rentabilidade"
            value={fin.rentabilidade_pct != null ? `${fin.rentabilidade_pct}%` : '—'}
            sub="último mês"
            color={fin.rentabilidade_pct != null && fin.rentabilidade_pct >= 0 ? 'var(--green-800)' : 'var(--red-600)'}
            bg={fin.rentabilidade_pct != null && fin.rentabilidade_pct >= 0 ? 'var(--green-100)' : 'var(--red-100)'}
            icon={<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
          />
        </div>
      )}

      {/* Alertas urgentes */}
      {vacinasUrgentes.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 24, padding: '14px 18px' }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <div>
            <strong>Atenção!</strong> {vacinasUrgentes.length} vacinação(ões) urgente(s) nos próximos 7 dias.{' '}
            <span
              onClick={() => navigate('/saude')}
              style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
            >
              Ver agora →
            </span>
          </div>
        </div>
      )}

      {/* Cards de alertas */}
      <div className="grid-2" style={{ gap: 20 }}>
        {/* Próximas vacinas */}
        <div className="card card-padded">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--pink-100)' }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="var(--pink-600)" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </span>
              Próximas Vacinas <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--gray-400)' }}>(30 dias)</span>
            </h2>
            {data.proximas_vacinas.length > 0 && (
              <span className="badge badge-pink">{data.proximas_vacinas.length}</span>
            )}
          </div>

          {data.proximas_vacinas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
              Nenhuma vacina agendada
            </div>
          ) : (
            <div className="table-wrapper">
            <table className="data-table">
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
                        <div style={{ fontWeight: 500 }}>{v.descricao}</div>
                        {urgente && <span className="badge badge-red" style={{ marginTop: 2, fontSize: 10 }}>Urgente — {dias}d</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: urgente ? 'var(--red-600)' : 'var(--amber-600)', fontSize: 13 }}>
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

        {/* Partos previstos */}
        <div className="card card-padded">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--green-100)' }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="var(--green-700)" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                </svg>
              </span>
              Partos Previstos <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--gray-400)' }}>(60 dias)</span>
            </h2>
            {data.partos_previstos.length > 0 && (
              <span className="badge badge-green">{data.partos_previstos.length}</span>
            )}
          </div>

          {data.partos_previstos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🐄</div>
              Nenhum parto previsto
            </div>
          ) : (
            <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Animal</th>
                  <th style={{ textAlign: 'right' }}>Previsão de Parto</th>
                </tr>
              </thead>
              <tbody>
                {data.partos_previstos.map(p => (
                  <tr key={p.id} className="clickable" onClick={() => navigate(`/animais/${p.animal_id}`)}>
                    <td>
                      <div style={{ fontWeight: 500 }}>Animal #{p.animal_id}</div>
                      {p.touro_brinco && <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Touro: #{p.touro_brinco}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green-700)', fontSize: 13 }}>
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

      {/* Atalhos rápidos */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ações rápidas</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Analise Financeira', path: '/financeiro', color: 'var(--green-800)', bg: 'var(--green-100)' },
            { label: 'Registrar Pesagem', path: '/pesagens', color: 'var(--amber-600)', bg: 'var(--amber-100)' },
            { label: 'Registrar Vacinação', path: '/saude', color: 'var(--pink-600)', bg: 'var(--pink-100)' },
            { label: 'Nova Movimentação', path: '/movimentacoes', color: 'var(--blue-600)', bg: 'var(--blue-100)' },
            { label: 'Controle Reprodutivo', path: '/reproducao', color: 'var(--teal-600)', bg: 'var(--teal-100)' },
          ].map(a => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', borderRadius: 'var(--radius)',
                background: a.bg, color: a.color,
                border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
