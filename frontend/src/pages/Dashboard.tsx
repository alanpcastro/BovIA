import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { Dashboard as DashboardData } from '../services/api'

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  border: '1px solid #e5e7eb',
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ ...card, borderTop: `4px solid ${color || '#2d6a4f'}` }}>
      <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#111', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: '#6b7280' }}>Carregando...</div>
  if (!data) return null

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 24 }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Animais" value={data.total_animais} color="#2d6a4f" />
        <StatCard label="Machos" value={data.total_machos} color="#3b82f6" />
        <StatCard label="Fêmeas" value={data.total_femeas} color="#ec4899" />
        <StatCard
          label="Peso Médio"
          value={data.peso_medio_kg ? `${data.peso_medio_kg} kg` : '—'}
          sub="última pesagem"
          color="#f59e0b"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Próximas vacinas */}
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 16 }}>
            💉 Próximas Vacinas (30 dias)
          </h2>
          {data.proximas_vacinas.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Nenhuma vacina agendada</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', color: '#6b7280', fontWeight: 500 }}>Descrição</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', color: '#6b7280', fontWeight: 500 }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {data.proximas_vacinas.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onClick={() => navigate(`/animais/${v.animal_id}`)}>
                    <td style={{ padding: '8px 0', color: '#111' }}>{v.descricao}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: '#d97706', fontWeight: 600 }}>
                      {new Date(v.proxima_data + 'T00:00').toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Partos previstos */}
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 16 }}>
            🐮 Partos Previstos (60 dias)
          </h2>
          {data.partos_previstos.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Nenhum parto previsto</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', color: '#6b7280', fontWeight: 500 }}>Animal</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', color: '#6b7280', fontWeight: 500 }}>Previsão</th>
                </tr>
              </thead>
              <tbody>
                {data.partos_previstos.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onClick={() => navigate(`/animais/${p.animal_id}`)}>
                    <td style={{ padding: '8px 0', color: '#111' }}>Animal #{p.animal_id}{p.touro_brinco ? ` · Touro: ${p.touro_brinco}` : ''}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: '#2d6a4f', fontWeight: 600 }}>
                      {new Date(p.data_prevista_parto + 'T00:00').toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button onClick={() => navigate('/animais')} style={{ background: '#2d6a4f', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Ver Animais
        </button>
        <button onClick={() => navigate('/pesagens')} style={{ background: '#fff', color: '#2d6a4f', border: '1px solid #2d6a4f', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Registrar Pesagem
        </button>
      </div>
    </div>
  )
}
