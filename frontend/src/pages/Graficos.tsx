import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import api, { AnaliseFinanceira, Pesagem, Lote, Animal } from '../services/api'
import { formatBRL, formatKg, formatPct, formatNumber } from '../utils/format'
import { toLocalDate } from '../utils/date'

const COLORS = ['#2d6a4f', '#d97706', '#db2777', '#2563eb', '#0d9488', '#6b7280']

type MesData = {
  mes: string
  receita: number
  custo: number
}

function formatMesLabel(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

function primeiroDiaMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function ultimoDiaMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

const toISO = toLocalDate

export default function Graficos() {
  const [pesagens, setPesagens] = useState<Pesagem[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [fin, setFin] = useState<AnaliseFinanceira | null>(null)
  const [serieMensal, setSerieMensal] = useState<MesData[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros do gráfico de evolução de peso
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'animal' | 'lote'>('todos')
  const [filtroAnimalId, setFiltroAnimalId] = useState<string>('')
  const [filtroLoteId, setFiltroLoteId] = useState<string>('')

  useEffect(() => {
    const hoje = new Date()
    const seisAtras = new Date(hoje)
    seisAtras.setMonth(seisAtras.getMonth() - 6)

    // Janelas mensais para a série temporal (últimos 6 meses, incluindo o atual)
    const meses: { inicio: Date; fim: Date; label: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      meses.push({
        inicio: primeiroDiaMes(ref),
        fim: ultimoDiaMes(ref),
        label: formatMesLabel(ref),
      })
    }

    Promise.all([
      api.get('/pesagens'),
      api.get('/lotes'),
      api.get('/animais', { params: { status: 'ativo', page_size: 200 } }),
      api.get('/financeiro/analise', {
        params: { data_inicio: toISO(seisAtras), data_fim: toISO(hoje) }
      }).catch(() => ({ data: null })),
      Promise.all(meses.map(m =>
        api.get('/financeiro/analise', {
          params: { data_inicio: toISO(m.inicio), data_fim: toISO(m.fim) }
        }).then(r => ({ label: m.label, data: r.data }))
         .catch(() => ({ label: m.label, data: null }))
      )),
    ]).then(([pRes, lRes, aRes, fRes, mensalRes]) => {
      setPesagens(pRes.data)
      setLotes(lRes.data)
      setAnimais(aRes.data.items ?? aRes.data)
      setFin(fRes.data)
      setSerieMensal(mensalRes.map(({ label, data }) => ({
        mes: label,
        receita: data?.receita_vendas ?? 0,
        custo: data
          ? (data.custo_nutricional_total ?? 0) +
            (data.custo_operacional_total ?? 0) +
            (data.custo_saude_total ?? 0) +
            (data.custo_compras ?? 0)
          : 0,
      })))
    }).finally(() => setLoading(false))
  }, [])

  // --- Hooks (devem ser chamados antes de qualquer early return) ---
  const pesoData = useMemo(() => {
    if (filtroTipo === 'animal' && !filtroAnimalId) return []
    if (filtroTipo === 'lote' && !filtroLoteId) return []

    let filtradas = pesagens
    if (filtroTipo === 'animal' && filtroAnimalId) {
      filtradas = pesagens.filter(p => p.animal_id === parseInt(filtroAnimalId))
    } else if (filtroTipo === 'lote' && filtroLoteId) {
      const loteId = parseInt(filtroLoteId)
      const idsDoLote = new Set(animais.filter(a => a.lote_id === loteId).map(a => a.id))
      filtradas = pesagens.filter(p => idsDoLote.has(p.animal_id))
    }

    if (filtroTipo === 'animal' && filtroAnimalId) {
      return [...filtradas]
        .sort((a, b) => a.data.localeCompare(b.data))
        .map(p => ({
          data: new Date(p.data + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          peso: p.peso_kg,
        }))
    }

    const porData = new Map<string, { soma: number; qtd: number }>()
    for (const p of filtradas) {
      const slot = porData.get(p.data) ?? { soma: 0, qtd: 0 }
      slot.soma += p.peso_kg
      slot.qtd += 1
      porData.set(p.data, slot)
    }
    return Array.from(porData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([data, { soma, qtd }]) => ({
        data: new Date(data + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        peso: Math.round((soma / qtd) * 10) / 10,
      }))
  }, [pesagens, animais, filtroTipo, filtroAnimalId, filtroLoteId])

  const gmdPorLote = useMemo(() => {
    const map = Object.fromEntries(animais.map(a => [a.id, a])) as Record<number, Animal>
    const acc = new Map<number, { soma: number; qtd: number }>()
    for (const p of pesagens) {
      if (p.gmd == null) continue
      const animal = map[p.animal_id]
      if (!animal?.lote_id) continue
      const slot = acc.get(animal.lote_id) ?? { soma: 0, qtd: 0 }
      slot.soma += p.gmd
      slot.qtd += 1
      acc.set(animal.lote_id, slot)
    }
    return lotes
      .map(l => {
        const slot = acc.get(l.id)
        return slot && slot.qtd > 0
          ? { name: l.nome, gmd: Math.round((slot.soma / slot.qtd) * 1000) / 1000, amostras: slot.qtd }
          : null
      })
      .filter((x): x is { name: string; gmd: number; amostras: number } => x !== null)
      .sort((a, b) => b.gmd - a.gmd)
  }, [pesagens, animais, lotes])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--gray-500)', padding: 40 }}>
      <span className="spinner spinner-dark" />
      Carregando graficos...
    </div>
  )

  // --- Valores derivados (consts simples, podem ficar depois do early return) ---
  const animaisMap = Object.fromEntries(animais.map(a => [a.id, a]))

  const tituloEvolucao = filtroTipo === 'animal' && filtroAnimalId
    ? `Evolução de Peso — #${animaisMap[parseInt(filtroAnimalId)]?.brinco ?? filtroAnimalId}`
    : filtroTipo === 'lote' && filtroLoteId
      ? `Evolução de Peso Médio — ${lotes.find(l => String(l.id) === filtroLoteId)?.nome ?? ''}`
      : 'Evolução de Peso Médio (rebanho)'

  const custosPie = fin ? [
    { name: 'Nutricional', value: fin.custo_nutricional_total },
    { name: 'Operacional', value: fin.custo_operacional_total },
    { name: 'Saude', value: fin.custo_saude_total },
  ].filter(c => c.value > 0) : []

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Graficos</div>
          <div className="page-subtitle">Visualizacao de dados do rebanho e financeiro</div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 24 }}>
        {/* Evolução de peso (com filtro) */}
        <div className="card card-padded">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{tituloEvolucao}</h3>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={filtroTipo}
              onChange={e => {
                const v = e.target.value as 'todos' | 'animal' | 'lote'
                setFiltroTipo(v)
                if (v !== 'animal') setFiltroAnimalId('')
                if (v !== 'lote') setFiltroLoteId('')
              }}
            >
              <option value="todos">Todo rebanho</option>
              <option value="animal">Por animal</option>
              <option value="lote">Por lote</option>
            </select>
            {filtroTipo === 'animal' && (
              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={filtroAnimalId}
                onChange={e => setFiltroAnimalId(e.target.value)}
              >
                <option value="">Selecione um animal...</option>
                {animais.map(a => (
                  <option key={a.id} value={a.id}>#{a.brinco || a.id}{a.nome ? ` — ${a.nome}` : ''}</option>
                ))}
              </select>
            )}
            {filtroTipo === 'lote' && (
              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={filtroLoteId}
                onChange={e => setFiltroLoteId(e.target.value)}
              >
                <option value="">Selecione um lote...</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            )}
          </div>

          {pesoData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-500)', fontSize: 13 }}>
              {filtroTipo !== 'todos' && !(filtroAnimalId || filtroLoteId)
                ? 'Selecione um item acima'
                : 'Sem pesagens registradas'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={pesoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" kg" />
                <Tooltip formatter={(v) => [formatKg(Number(v), 1), 'Peso']} />
                <Line type="monotone" dataKey="peso" stroke="#2d6a4f" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Composição de custos */}
        <div className="card card-padded">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Composicao de Custos (6 meses)</h3>
          {custosPie.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-500)', fontSize: 13 }}>
              Sem custos registrados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={custosPie}
                  cx="50%" cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${formatPct((percent ?? 0) * 100, 0)}`}
                >
                  {custosPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatBRL(v as number)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Receita vs Custo por mês */}
        <div className="card card-padded">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Receita vs Custo por Mês</h3>
          {serieMensal.every(m => m.receita === 0 && m.custo === 0) ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-500)', fontSize: 13 }}>
              Sem dados financeiros nos últimos 6 meses
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={serieMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatBRL(v as number)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Receita" fill="#2d6a4f" radius={[6, 6, 0, 0]} />
                <Bar dataKey="custo" name="Custo total" fill="#dc2626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* GMD por lote */}
        <div className="card card-padded">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>GMD Médio por Lote (kg/dia)</h3>
          {gmdPorLote.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-500)', fontSize: 13 }}>
              Sem pesagens suficientes para calcular GMD por lote
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={gmdPorLote} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v) => [`${formatNumber(v as number, 3)} kg/dia`, 'GMD']} />
                <Bar dataKey="gmd" radius={[0, 6, 6, 0]}>
                  {gmdPorLote.map((entry, i) => (
                    <Cell key={i} fill={entry.gmd >= 0 ? COLORS[i % COLORS.length] : '#dc2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
