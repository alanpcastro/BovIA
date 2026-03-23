import { useEffect, useState, FormEvent } from 'react'
import api, { Lote } from '../services/api'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }
const input: React.CSSProperties = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' }
const btn = (variant = 'primary'): React.CSSProperties => ({
  padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  background: variant === 'primary' ? '#2d6a4f' : variant === 'danger' ? '#dc2626' : '#f3f4f6',
  color: variant === 'ghost' ? '#374151' : '#fff',
})

export default function Lotes() {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Lote | null>(null)
  const [nome, setNome] = useState('')
  const [area, setArea] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState('')

  function resetForm() { setNome(''); setArea(''); setDescricao(''); setEditing(null); setErro('') }

  function load() { api.get('/lotes').then(r => setLotes(r.data)) }
  useEffect(load, [])

  function openEdit(l: Lote) {
    setEditing(l)
    setNome(l.nome)
    setArea(l.area_ha?.toString() || '')
    setDescricao(l.descricao || '')
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    const payload = { nome, area_ha: area ? parseFloat(area) : undefined, descricao: descricao || undefined }
    try {
      if (editing) await api.put(`/lotes/${editing.id}`, payload)
      else await api.post('/lotes', payload)
      resetForm()
      setShowForm(false)
      load()
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao salvar')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este lote?')) return
    await api.delete(`/lotes/${id}`)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Lotes / Pastos</h1>
        <button style={btn()} onClick={() => { resetForm(); setShowForm(true) }}>+ Novo Lote</button>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{editing ? 'Editar Lote' : 'Novo Lote'}</h2>
          {erro && <div style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>{erro}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome *</label>
                <input style={input} value={nome} onChange={e => setNome(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Área (ha)</label>
                <input style={input} type="number" step="0.1" value={area} onChange={e => setArea(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Descrição</label>
              <input style={input} value={descricao} onChange={e => setDescricao(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={btn()}>Salvar</button>
              <button type="button" style={btn('ghost')} onClick={() => { resetForm(); setShowForm(false) }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {lotes.length === 0 && <p style={{ color: '#9ca3af' }}>Nenhum lote cadastrado.</p>}
        {lotes.map(l => (
          <div key={l.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>🌿 {l.nome}</div>
                {l.area_ha && <div style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>{l.area_ha} hectares</div>}
                {l.descricao && <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>{l.descricao}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ ...btn('ghost'), padding: '5px 10px' }} onClick={() => openEdit(l)}>✏️</button>
                <button style={{ ...btn('danger'), padding: '5px 10px' }} onClick={() => handleDelete(l.id)}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
