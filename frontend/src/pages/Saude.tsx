import { useEffect, useState, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { Saude as SaudeType, Animal } from '../services/api'

const input: React.CSSProperties = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' }
const btn = (v = 'primary'): React.CSSProperties => ({
  padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  background: v === 'primary' ? '#2d6a4f' : v === 'danger' ? '#dc2626' : '#f3f4f6',
  color: v === 'ghost' ? '#374151' : '#fff',
})

const tipos = ['vacinacao', 'vermifugacao', 'tratamento', 'exame', 'cirurgia']

export default function Saude() {
  const [params] = useSearchParams()
  const animalIdParam = params.get('animal_id')

  const [registros, setRegistros] = useState<SaudeType[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [showForm, setShowForm] = useState(!!animalIdParam)
  const [filtroAnimal, setFiltroAnimal] = useState(animalIdParam || '')
  const [form, setForm] = useState({
    animal_id: animalIdParam || '', tipo: 'vacinacao', data: new Date().toISOString().split('T')[0],
    descricao: '', medicamento: '', dose: '', custo: '', responsavel: '', proxima_data: '', observacoes: ''
  })
  const [erro, setErro] = useState('')

  useEffect(() => { api.get('/animais').then(r => setAnimais(r.data)) }, [])
  function load() {
    const p: any = {}
    if (filtroAnimal) p.animal_id = filtroAnimal
    api.get('/saude', { params: p }).then(r => setRegistros(r.data))
  }
  useEffect(load, [filtroAnimal])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      await api.post('/saude', {
        animal_id: parseInt(form.animal_id), tipo: form.tipo, data: form.data, descricao: form.descricao,
        medicamento: form.medicamento || undefined, dose: form.dose || undefined,
        custo: form.custo ? parseFloat(form.custo) : undefined, responsavel: form.responsavel || undefined,
        proxima_data: form.proxima_data || undefined, observacoes: form.observacoes || undefined
      })
      setShowForm(false)
      load()
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao registrar')
    }
  }

  async function deletar(id: number) {
    if (!confirm('Excluir este registro?')) return
    await api.delete(`/saude/${id}`)
    load()
  }

  const animaisMap = Object.fromEntries(animais.map(a => [a.id, a]))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Saúde</h1>
        <button style={btn()} onClick={() => setShowForm(!showForm)}>+ Registrar</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Novo Registro de Saúde</h2>
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
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tipo *</label>
                <select style={input} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} required>
                  {tipos.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data *</label>
                <input style={input} type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Descrição *</label>
              <input style={input} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} required placeholder="Ex: Vacina contra febre aftosa" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              {[
                { label: 'Medicamento', key: 'medicamento', placeholder: '' },
                { label: 'Dose', key: 'dose', placeholder: 'Ex: 5ml' },
                { label: 'Responsável', key: 'responsavel', placeholder: '' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input style={input} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Custo (R$)</label>
                <input style={input} type="number" step="0.01" value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Próxima Data</label>
                <input style={input} type="date" value={form.proxima_data} onChange={e => setForm(f => ({ ...f, proxima_data: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={btn()}>Registrar</button>
              <button type="button" style={btn('ghost')} onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #e5e7eb', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Filtrar por animal:</label>
        <select style={{ ...input, width: 260 }} value={filtroAnimal} onChange={e => setFiltroAnimal(e.target.value)}>
          <option value="">Todos</option>
          {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              {['Animal', 'Data', 'Tipo', 'Descrição', 'Medicamento', 'Custo', 'Próxima', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nenhum registro encontrado</td></tr>}
            {registros.map(s => {
              const a = animaisMap[s.animal_id]
              return (
                <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{a ? `#${a.brinco}` : `#${s.animal_id}`}</td>
                  <td style={{ padding: '12px 16px' }}>{new Date(s.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ background: '#f0fdf4', color: '#2d6a4f', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{s.tipo.replace('_', ' ')}</span></td>
                  <td style={{ padding: '12px 16px', maxWidth: 200 }}>{s.descricao}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{s.medicamento || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{s.custo != null ? `R$ ${s.custo.toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '12px 16px', color: s.proxima_data ? '#d97706' : '#9ca3af', fontSize: 13, fontWeight: s.proxima_data ? 600 : 400 }}>
                    {s.proxima_data ? new Date(s.proxima_data + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button style={{ ...btn('danger'), padding: '5px 10px' }} onClick={() => deletar(s.id)}>🗑️</button>
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
