import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { Alerta, AlertaTipo } from '../services/api'
import { useToast } from '../components/Toast'
import { apiErrorMessage } from '../utils/apiError'

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
  const { success, error: toastError } = useToast()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<'' | AlertaTipo>('')
  const [filtroSev, setFiltroSev] = useState<'' | 'alta' | 'media' | 'baixa'>('')
  // Alertas que o produtor tirou da lista — carregados só quando ele pede pra ver
  const [mostrarDispensados, setMostrarDispensados] = useState(false)
  const [dispensados, setDispensados] = useState<Alerta[] | null>(null)
  const [processando, setProcessando] = useState<string | null>(null)

  function carregar() {
    return api.get<Alerta[]>('/alertas').then(r => setAlertas(r.data))
  }

  function carregarDispensados() {
    return api.get<Alerta[]>('/alertas', { params: { dispensados: true } }).then(r => setDispensados(r.data))
  }

  useEffect(() => {
    setLoading(true)
    carregar().finally(() => setLoading(false))
  }, [])

  // `?? []`: backend e frontend sobem em deploys separados; um backend antigo ainda não manda chaves
  const chaveDe = (a: Alerta) => (a.chaves ?? []).join('|') || `${a.tipo}-${a.entidade_id}-${a.titulo}`

  async function dispensar(a: Alerta) {
    setProcessando(chaveDe(a))
    setAlertas(prev => prev.filter(x => x !== a))  // some na hora; o servidor confirma em seguida
    try {
      await api.post('/alertas/dispensar', { chaves: a.chaves })
      success('Alerta dispensado. Para trazer de volta, use "Ver alertas dispensados".')
      if (mostrarDispensados) carregarDispensados()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao dispensar alerta'))
      carregar()
    } finally {
      setProcessando(null)
    }
  }

  async function restaurar(a: Alerta) {
    setProcessando(chaveDe(a))
    try {
      await api.post('/alertas/restaurar', { chaves: a.chaves })
      setDispensados(prev => (prev ?? []).filter(x => x !== a))
      await carregar()
      success('Alerta de volta na lista')
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao restaurar alerta'))
    } finally {
      setProcessando(null)
    }
  }

  function alternarDispensados() {
    const abrir = !mostrarDispensados
    setMostrarDispensados(abrir)
    if (abrir) {
      setDispensados(null)
      carregarDispensados()
    }
  }

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
        {filtrados.map(a => (
          <div key={chaveDe(a)} className="card alerta-card" style={{ borderLeftColor: sevColor[a.severidade] }}>
            <button className="alerta-card-main" onClick={() => navigate(a.link)}>
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
            </button>
            <button
              className="alerta-card-dispensar"
              onClick={() => dispensar(a)}
              disabled={processando === chaveDe(a)}
              aria-label={`Dispensar alerta: ${a.titulo}`}
              title="Dispensar alerta"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Dispensados: o produtor pode tirar qualquer alerta da lista — e trazer de volta */}
      <div className="alertas-dispensados">
        <button className="btn btn-ghost btn-sm" onClick={alternarDispensados}>
          {mostrarDispensados ? 'Ocultar alertas dispensados' : 'Ver alertas dispensados'}
        </button>
        {mostrarDispensados && (
          dispensados === null ? (
            <div className="alerta-dispensado-msg" style={{ marginTop: 12 }}>
              <span className="spinner spinner-dark" /> Carregando...
            </div>
          ) : dispensados.length === 0 ? (
            <div className="alerta-dispensado-msg" style={{ marginTop: 12 }}>Nenhum alerta dispensado.</div>
          ) : (
            <div className="alertas-dispensados-lista">
              {dispensados.map(a => (
                <div key={chaveDe(a)} className="card alerta-dispensado">
                  <div style={{ minWidth: 0 }}>
                    <div className="alerta-dispensado-titulo">{a.titulo}</div>
                    <div className="alerta-dispensado-msg">{a.mensagem}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => restaurar(a)} disabled={processando === chaveDe(a)}>
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
