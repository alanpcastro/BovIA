import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { Alerta, AlertaTipo } from '../services/api'

const tipoLabel: Record<AlertaTipo, string> = {
  vacina: 'Vacina',
  superlotacao: 'Superlotação',
  sem_rotacao: 'Sem rotação',
  descanso_excedido: 'Descanso pronto',
  abate: 'Abate',
  parto: 'Parto',
}

const tipoBadge: Record<AlertaTipo, string> = {
  vacina: 'badge-pink',
  superlotacao: 'badge-red',
  sem_rotacao: 'badge-amber',
  descanso_excedido: 'badge-teal',
  abate: 'badge-green',
  parto: 'badge-blue',
}

const sevColor: Record<string, string> = {
  alta: 'var(--red-600)',
  media: 'var(--amber-600)',
  baixa: 'var(--teal-600)',
}

const sevLabel: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

const tiposDisponiveis: AlertaTipo[] = ['vacina', 'superlotacao', 'sem_rotacao', 'descanso_excedido', 'abate', 'parto']

export default function Agenda() {
  const navigate = useNavigate()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<'' | AlertaTipo>('')
  const [filtroSev, setFiltroSev] = useState<'' | 'alta' | 'media' | 'baixa'>('')

  useEffect(() => {
    setLoading(true)
    api.get('/alertas')
      .then(r => setAlertas(r.data))
      .finally(() => setLoading(false))
  }, [])

  const filtrados = alertas.filter(a =>
    (!filtroTipo || a.tipo === filtroTipo) &&
    (!filtroSev || a.severidade === filtroSev)
  )

  const totalAlta = alertas.filter(a => a.severidade === 'alta').length
  const totalMedia = alertas.filter(a => a.severidade === 'media').length
  const totalBaixa = alertas.filter(a => a.severidade === 'baixa').length

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Agenda de Alertas</div>
          <div className="page-subtitle">{alertas.length} alerta(s) ativo(s)</div>
        </div>
      </div>

      {/* Resumo por severidade */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card card-padded" style={{ textAlign: 'center', borderTop: `4px solid ${sevColor.alta}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Crítica</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: sevColor.alta }}>{totalAlta}</div>
        </div>
        <div className="card card-padded" style={{ textAlign: 'center', borderTop: `4px solid ${sevColor.media}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Média</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: sevColor.media }}>{totalMedia}</div>
        </div>
        <div className="card card-padded" style={{ textAlign: 'center', borderTop: `4px solid ${sevColor.baixa}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Baixa</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: sevColor.baixa }}>{totalBaixa}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filters-bar">
        <label className="filter-label">Tipo:</label>
        <select className="form-select" style={{ width: 200 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as '' | AlertaTipo)}>
          <option value="">Todos</option>
          {tiposDisponiveis.map(t => <option key={t} value={t}>{tipoLabel[t]}</option>)}
        </select>
        <label className="filter-label" style={{ marginLeft: 12 }}>Severidade:</label>
        <select className="form-select" style={{ width: 160 }} value={filtroSev} onChange={e => setFiltroSev(e.target.value as '' | 'alta' | 'media' | 'baixa')}>
          <option value="">Todas</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>

      {loading && (
        <div className="card card-padded" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-500)' }}>
          <span className="spinner" /> Carregando alertas...
        </div>
      )}

      {!loading && filtrados.length === 0 && (
        <div className="card card-padded" style={{ textAlign: 'center', padding: 48 }}>
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="var(--green-700)" strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 6 }}>Tudo em dia</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            {alertas.length === 0 ? 'Nenhum alerta ativo no momento' : 'Nenhum alerta com esses filtros'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtrados.map((a, i) => (
          <button
            key={`${a.tipo}-${a.entidade_id}-${i}`}
            className="card card-padded"
            onClick={() => navigate(a.link)}
            style={{
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              borderLeft: `4px solid ${sevColor[a.severidade]}`,
              transition: 'transform var(--transition), box-shadow var(--transition)',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <span className={`badge ${tipoBadge[a.tipo]}`}>{tipoLabel[a.tipo]}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sevColor[a.severidade], textTransform: 'uppercase' }}>
                    {sevLabel[a.severidade]}
                  </span>
                  {a.data && (
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      · {new Date(a.data + 'T00:00').toLocaleDateString('pt-BR')}
                      {a.dias !== null && a.dias !== undefined && (
                        <span style={{ marginLeft: 4, fontWeight: 600, color: a.dias < 0 ? sevColor.alta : 'var(--gray-600)' }}>
                          ({a.dias < 0 ? `${-a.dias}d atrasado` : a.dias === 0 ? 'hoje' : `em ${a.dias}d`})
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)', marginBottom: 4 }}>
                  {a.titulo}
                </div>
                <div style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.5 }}>
                  {a.mensagem}
                </div>
              </div>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--gray-400)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 4 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
