import { useEffect, useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { Animal, Lote } from '../services/api'

const input: React.CSSProperties = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' }
const btn = (variant = 'primary'): React.CSSProperties => ({
  padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  background: variant === 'primary' ? '#2d6a4f' : variant === 'danger' ? '#dc2626' : '#f3f4f6',
  color: variant === 'ghost' ? '#374151' : '#fff',
})

const statusColor: Record<string, string> = { ativo: '#16a34a', vendido: '#3b82f6', morto: '#6b7280', transferido: '#d97706' }

export default function Animais() {
  const navigate = useNavigate()
  const [animais, setAnimais] = useState<Animal[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filtros, setFiltros] = useState({ status: '', sexo: '', lote_id: '', raca: '' })
  const [form, setForm] = useState({ brinco: '', nome: '', raca: '', sexo: 'macho', data_nascimento: '', peso_entrada: '', origem: 'nascido', lote_id: '', observacoes: '' })
  const [erro, setErro] = useState('')

  function load() {
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v))
    api.get('/animais', { params }).then(r => setAnimais(r.data))
  }

  useEffect(() => { api.get('/lotes').then(r => setLotes(r.data)) }, [])
  useEffect(load, [filtros])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    const payload = {
      brinco: form.brinco,
      nome: form.nome || undefined,
      raca: form.raca || undefined,
      sexo: form.sexo,
      data_nascimento: form.data_nascimento || undefined,
      peso_entrada: form.peso_entrada ? parseFloat(form.peso_entrada) : undefined,
      origem: form.origem || undefined,
      lote_id: form.lote_id ? parseInt(form.lote_id) : undefined,
      observacoes: form.observacoes || undefined,
    }
    try {
      await api.post('/animais', payload)
      setShowForm(false)
      setForm({ brinco: '', nome: '', raca: '', sexo: 'macho', data_nascimento: '', peso_entrada: '', origem: 'nascido', lote_id: '', observacoes: '' })
      load()
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao cadastrar animal')
    }
  }

  const lotesMap = Object.fromEntries(lotes.map(l => [l.id, l.nome]))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Animais</h1>
        <button style={btn()} onClick={() => setShowForm(!showForm)}>+ Novo Animal</button>
      </div>

      {/* Filtros */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', border: '1px solid #e5e7eb', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select style={{ ...input, width: 'auto' }} value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="vendido">Vendido</option>
          <option value="morto">Morto</option>
          <option value="transferido">Transferido</option>
        </select>
        <select style={{ ...input, width: 'auto' }} value={filtros.sexo} onChange={e => setFiltros(f => ({ ...f, sexo: e.target.value }))}>
          <option value="">Todos os sexos</option>
          <option value="macho">Macho</option>
          <option value="femea">Fêmea</option>
        </select>
        <select style={{ ...input, width: 'auto' }} value={filtros.lote_id} onChange={e => setFiltros(f => ({ ...f, lote_id: e.target.value }))}>
          <option value="">Todos os lotes</option>
          {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <input style={{ ...input, width: 160 }} placeholder="Filtrar por raça" value={filtros.raca} onChange={e => setFiltros(f => ({ ...f, raca: e.target.value }))} />
      </div>

      {/* Formulário de cadastro */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Novo Animal</h2>
          {erro && <div style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>{erro}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              {[
                { label: 'Brinco *', key: 'brinco', req: true },
                { label: 'Nome', key: 'nome' },
                { label: 'Raça', key: 'raca' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input style={input} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required={f.req} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Sexo *</label>
                <select style={input} value={form.sexo} onChange={e => setForm(p => ({ ...p, sexo: e.target.value }))} required>
                  <option value="macho">Macho</option>
                  <option value="femea">Fêmea</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Origem</label>
                <select style={input} value={form.origem} onChange={e => setForm(p => ({ ...p, origem: e.target.value }))}>
                  <option value="nascido">Nascido na fazenda</option>
                  <option value="comprado">Comprado</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Lote</label>
                <select style={input} value={form.lote_id} onChange={e => setForm(p => ({ ...p, lote_id: e.target.value }))}>
                  <option value="">Sem lote</option>
                  {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data de Nascimento</label>
                <input style={input} type="date" value={form.data_nascimento} onChange={e => setForm(p => ({ ...p, data_nascimento: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Peso de Entrada (kg)</label>
                <input style={input} type="number" step="0.1" value={form.peso_entrada} onChange={e => setForm(p => ({ ...p, peso_entrada: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Observações</label>
              <input style={input} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={btn()}>Cadastrar</button>
              <button type="button" style={btn('ghost')} onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              {['Brinco', 'Nome', 'Raça', 'Sexo', 'Lote', 'Peso Entrada', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {animais.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nenhum animal encontrado</td></tr>
            )}
            {animais.map(a => (
              <tr key={a.id} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => navigate(`/animais/${a.id}`)}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>#{a.brinco}</td>
                <td style={{ padding: '12px 16px', color: '#374151' }}>{a.nome || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{a.raca || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{a.sexo === 'macho' ? '♂ Macho' : '♀ Fêmea'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{a.lote_id ? lotesMap[a.lote_id] || '—' : '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{a.peso_entrada ? `${a.peso_entrada} kg` : '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: statusColor[a.status] + '20', color: statusColor[a.status], padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    {a.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ color: '#2d6a4f', fontSize: 13, fontWeight: 600 }}>Ver →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6', fontSize: 13, color: '#9ca3af' }}>
          {animais.length} animal(is) encontrado(s)
        </div>
      </div>
    </div>
  )
}
