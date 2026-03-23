import { useEffect, useState, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { Pesagem, Animal } from '../services/api'

const input: React.CSSProperties = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' }
const btn = (v = 'primary'): React.CSSProperties => ({
  padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  background: v === 'primary' ? '#2d6a4f' : v === 'danger' ? '#dc2626' : '#f3f4f6',
  color: v === 'ghost' ? '#374151' : '#fff',
})

export default function Pesagens() {
  const [params] = useSearchParams()
  const animalIdParam = params.get('animal_id')

  const [pesagens, setPesagens] = useState<Pesagem[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [showForm, setShowForm] = useState(!!animalIdParam)
  const [filtroAnimal, setFiltroAnimal] = useState(animalIdParam || '')
  const [form, setForm] = useState({ animal_id: animalIdParam || '', data: new Date().toISOString().split('T')[0], peso_kg: '', observacoes: '' })
  const [erro, setErro] = useState('')

  useEffect(() => {
    api.get('/animais', { params: { status: 'ativo' } }).then(r => setAnimais(r.data))
  }, [])

  function load() {
    const p: any = {}
    if (filtroAnimal) p.animal_id = filtroAnimal
    api.get('/pesagens', { params: p }).then(r => setPesagens(r.data))
  }
  useEffect(load, [filtroAnimal])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      await api.post('/pesagens', { animal_id: parseInt(form.animal_id), data: form.data, peso_kg: parseFloat(form.peso_kg), observacoes: form.observacoes || undefined })
      setForm(f => ({ ...f, peso_kg: '', observacoes: '' }))
      setShowForm(false)
      load()
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao registrar pesagem')
    }
  }

  async function deletar(id: number) {
    if (!confirm('Excluir esta pesagem?')) return
    await api.delete(`/pesagens/${id}`)
    load()
  }

  const animaisMap = Object.fromEntries(animais.map(a => [a.id, a]))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Pesagens</h1>
        <button style={btn()} onClick={() => setShowForm(!showForm)}>+ Registrar Pesagem</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Nova Pesagem</h2>
          {erro && <div style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>{erro}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Animal *</label>
                <select style={input} value={form.animal_id} onChange={e => setForm(f => ({ ...f, animal_id: e.target.value }))} required>
                  <option value="">Selecione...</option>
                  {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data *</label>
                <input style={input} type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Peso (kg) *</label>
                <input style={input} type="number" step="0.1" value={form.peso_kg} onChange={e => setForm(f => ({ ...f, peso_kg: e.target.value }))} required />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Observações</label>
              <input style={input} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={btn()}>Registrar</button>
              <button type="button" style={btn('ghost')} onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Filtro */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #e5e7eb', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Filtrar por animal:</label>
        <select style={{ ...input, width: 260 }} value={filtroAnimal} onChange={e => setFiltroAnimal(e.target.value)}>
          <option value="">Todos os animais</option>
          {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              {['Animal', 'Data', 'Peso', 'GMD (kg/dia)', 'Observações', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pesagens.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nenhuma pesagem registrada</td></tr>}
            {pesagens.map(p => {
              const animal = animaisMap[p.animal_id]
              return (
                <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{animal ? `#${animal.brinco}${animal.nome ? ` — ${animal.nome}` : ''}` : `#${p.animal_id}`}</td>
                  <td style={{ padding: '12px 16px' }}>{new Date(p.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2d6a4f' }}>{p.peso_kg} kg</td>
                  <td style={{ padding: '12px 16px', color: p.gmd != null ? (p.gmd > 0 ? '#16a34a' : '#dc2626') : '#9ca3af', fontWeight: 600 }}>
                    {p.gmd != null ? `${p.gmd > 0 ? '+' : ''}${p.gmd}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>{p.observacoes || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button style={{ ...btn('danger'), padding: '5px 10px' }} onClick={() => deletar(p.id)}>🗑️</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
