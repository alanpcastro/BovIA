import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import api, { AnaliseFinanceira, Pesagem, Lote } from '../services/api'

const COLORS = ['#2d6a4f', '#d97706', '#db2777', '#2563eb', '#0d9488', '#6b7280']

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Graficos() {
  const [pesagens, setPesagens] = useState<Pesagem[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [fin, setFin] = useState<AnaliseFinanceira | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hoje = new Date()
    const seisAtras = new Date(hoje)
    seisAtras.setMonth(seisAtras.getMonth() - 6)

    Promise.all([
      api.get('/pesagens'),
      api.get('/lotes'),
      api.get('/financeiro/analise', {
        params: { data_inicio: seisAtras.toISOString().split('T')[0], data_fim: hoje.toISOString().split('T')[0] }
      }).catch(() => ({ data: null })),
    ]).then(([pRes, lRes, fRes]) => {
      setPesagens(pRes.data)
      setLotes(lRes.data)
      setFin(fRes.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--gray-400)', padding: 40 }}>
      <span className="spinner spinner-dark" />
      Carregando graficos...
    </div>
  )

  // --- Weight evolution data (last 20 weighings, sorted by date) ---
  const pesoData = [...pesagens]
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(-30)
    .map(p => ({
      data: new Date(p.data + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      peso: p.peso_kg,
      gmd: p.gmd ?? 0,
    }))

  // --- Cost composition pie ---
  const custosPie = fin ? [
    { name: 'Nutricional', value: fin.custo_nutricional_total },
    { name: 'Operacional', value: fin.custo_operacional_total },
    { name: 'Saude', value: fin.custo_saude_total },
  ].filter(c => c.value > 0) : []

  // --- Revenue vs cost bar ---
  const resultadoBar = fin ? [
    { name: 'Receita Vendas', valor: fin.receita_vendas },
    { name: 'Custo Compras', valor: fin.custo_compras },
    { name: 'Custo Total', valor: fin.custo_nutricional_total + fin.custo_operacional_total + fin.custo_saude_total },
    { name: 'Lucro Liquido', valor: fin.lucro_liquido },
  ] : []

  // --- GMD per lote bar ---
  const gmdLotes = lotes
    .filter(l => (l.total_animais ?? 0) > 0)
    .map(l => ({ name: l.nome, animais: l.total_animais ?? 0 }))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Graficos</div>
          <div className="page-subtitle">Visualizacao de dados do rebanho e financeiro</div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 24 }}>
        {/* Weight evolution */}
        <div className="card card-padded">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Evolucao de Peso (Pesagens)</h3>
          {pesoData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)', fontSize: 13 }}>
              Sem pesagens registradas
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={pesoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" kg" />
                <Tooltip formatter={(v) => [`${v} kg`, 'Peso']} />
                <Line type="monotone" dataKey="peso" stroke="#2d6a4f" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cost composition pie */}
        <div className="card card-padded">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Composicao de Custos (6 meses)</h3>
          {custosPie.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)', fontSize: 13 }}>
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
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {custosPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v as number)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue vs Cost */}
        <div className="card card-padded">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Receita vs Custo (6 meses)</h3>
          {resultadoBar.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)', fontSize: 13 }}>
              Sem dados financeiros
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={resultadoBar}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v as number)} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {resultadoBar.map((entry, i) => (
                    <Cell key={i} fill={entry.valor >= 0 ? '#2d6a4f' : '#dc2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Animals per lote */}
        <div className="card card-padded">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Animais por Lote</h3>
          {gmdLotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)', fontSize: 13 }}>
              Sem lotes cadastrados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={gmdLotes}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="animais" fill="#2563eb" radius={[6, 6, 0, 0]} name="Animais" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
