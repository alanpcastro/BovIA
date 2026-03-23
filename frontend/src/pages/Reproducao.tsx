import { useEffect, useState, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { Reproducao as ReproducaoType, Animal } from '../services/api'

const input: React.CSSProperties = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' }
const btn = (v = 'primary'): React.CSSProperties => ({
  padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  background: v === 'primary' ? '#2d6a4f' : v === 'danger' ? '#dc2626' : '#f3f4f6',
  color: v === 'ghost' ? '#374151' : '#fff',
})

const tipos = ['cobertura_natural', 'inseminacao', 'transferencia_embriao', 'parto']
const resultados = ['prenha', 'vazia', 'nasceu bezerro', 'aborto']

export default function Reproducao() {
  const [params] = useSearchParams()
  const animalIdParam = params.get('animal_id')

  const [registros, setRegistros] = useState<ReproducaoType[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [showForm, setShowForm] = useState(!!animalIdParam)
  const [filtroAnimal, setFiltroAnimal] = useState(animalIdParam || '')
  const [form, setForm] = useState({
    animal_id: animalIdParam || '', tipo: 'inseminacao', data: new Date().toISOString().split('T')[0],
    touro_brinco: '', resultado: '', data_prevista_parto: '', bezerro_brinco: '', observacoes: ''
  })
  const [erro, setErro] = useState('')

  useEffect(() => { api.get('/animais', { params: { sexo: 'femea' } }).then(r => setAnimais(r.data)) }, [])
  function load() {
    const p: any = {}
    if (filtroAnimal) p.animal_id = filtroAnimal
    api.get('/reproducao', { params: p }).then(r => setRegistros(r.data))
  }
  useEffect(load, [filtroAnimal])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      await api.post('/reproducao', {
        animal_id: parseInt(form.animal_id), tipo: form.tipo, data: form.data,
        touro_brinco: form.touro_brinco || undefined, resultado: form.resultado || undefined,
        data_prevista_parto: form.data_prevista_parto || undefined,
        bezerro_brinco: form.bezerro_brinco || undefined, observacoes: form.observacoes || undefined
      })
      setShowForm(false)
      load()
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao registrar')
    }
  }

  async function deletar(id: number) {
    if (!confirm('Excluir este registro?')) return
    await api.delete(`/reproducao/${id}`)
    load()
  }

  const animaisMap = Object.fromEntries(animais.map(a => [a.id, a]))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Reprodução</h1>
        <button style={btn()} onClick={() => setShowForm(!showForm)}>+ Registrar</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Novo Registro Reprodutivo</h2>
          {erro && <div style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>{erro}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Animal (Fêmea) *</label>
                <select style={input} value={form.animal_id} onChange={e => setForm(f => ({ ...f, animal_id: e.target.value }))} required>
                  <option value="">Selecione...</option>
                  {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tipo *</label>
                <select style={input} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} required>
                  {tipos.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data *</label>
                <input style={input} type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Brinco do Touro</label>
                <input style={input} value={form.touro_brinco} onChange={e => setForm(f => ({ ...f, touro_brinco: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Resultado</label>
                <select style={input} value={form.resultado} onChange={e => setForm(f => ({ ...f, resultado: e.target.value }))}>
                  <option value="">Pendente</option>
                  {resultados.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data Prevista do Parto</label>
                <input style={input} type="date" value={form.data_prevista_parto} onChange={e => setForm(f => ({ ...f, data_prevista_parto: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Brinco do Bezerro</label>
                <input style={input} value={form.bezerro_brinco} onChange={e => setForm(f => ({ ...f, bezerro_brinco: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Observações</label>
                <input style={input} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
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
              {['Animal', 'Data', 'Tipo', 'Resultado', 'Touro', 'Parto Previsto', 'Bezerro', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nenhum registro encontrado</td></tr>}
            {registros.map(r => {
              const a = animaisMap[r.animal_id]
              return (
                <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{a ? `#${a.brinco}` : `#${r.animal_id}`}</td>
                  <td style={{ padding: '12px 16px' }}>{new Date(r.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{r.tipo.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {r.resultado ? <span style={{ background: '#f0fdf4', color: '#2d6a4f', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{r.resultado}</span> : <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{r.touro_brinco || '—'}</td>
                  <td style={{ padding: '12px 16px', color: r.data_prevista_parto ? '#2d6a4f' : '#9ca3af', fontWeight: r.data_prevista_parto ? 600 : 400, fontSize: 13 }}>
                    {r.data_prevista_parto ? new Date(r.data_prevista_parto + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{r.bezerro_brinco || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button style={{ ...btn('danger'), padding: '5px 10px' }} onClick={() => deletar(r.id)}>🗑️</button>
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
