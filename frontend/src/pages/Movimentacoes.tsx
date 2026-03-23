import { useEffect, useState, FormEvent } from 'react'
import api, { Movimentacao, Animal } from '../services/api'

const input: React.CSSProperties = { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' }
const btn = (v = 'primary'): React.CSSProperties => ({
  padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  background: v === 'primary' ? '#2d6a4f' : v === 'danger' ? '#dc2626' : '#f3f4f6',
  color: v === 'ghost' ? '#374151' : '#fff',
})

const tipos = ['compra', 'venda', 'transferencia', 'nascimento', 'morte']
const tipoColor: Record<string, string> = { compra: '#2563eb', venda: '#16a34a', transferencia: '#d97706', nascimento: '#ec4899', morte: '#6b7280' }

export default function Movimentacoes() {
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [form, setForm] = useState({
    animal_id: '', tipo: 'compra', data: new Date().toISOString().split('T')[0],
    valor: '', peso_kg: '', origem: '', destino: '', observacoes: ''
  })
  const [erro, setErro] = useState('')

  useEffect(() => { api.get('/animais').then(r => setAnimais(r.data)) }, [])
  function load() {
    const p: any = {}
    if (filtroTipo) p.tipo = filtroTipo
    api.get('/movimentacoes', { params: p }).then(r => setMovs(r.data))
  }
  useEffect(load, [filtroTipo])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      await api.post('/movimentacoes', {
        animal_id: parseInt(form.animal_id), tipo: form.tipo, data: form.data,
        valor: form.valor ? parseFloat(form.valor) : undefined,
        peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : undefined,
        origem: form.origem || undefined, destino: form.destino || undefined,
        observacoes: form.observacoes || undefined
      })
      setShowForm(false)
      setForm(f => ({ ...f, animal_id: '', valor: '', peso_kg: '', origem: '', destino: '', observacoes: '' }))
      load()
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao registrar')
    }
  }

  const animaisMap = Object.fromEntries(animais.map(a => [a.id, a]))

  // Totais
  const totalVendas = movs.filter(m => m.tipo === 'venda').reduce((acc, m) => acc + (m.valor || 0), 0)
  const totalCompras = movs.filter(m => m.tipo === 'compra').reduce((acc, m) => acc + (m.valor || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Movimentações</h1>
        <button style={btn()} onClick={() => setShowForm(!showForm)}>+ Registrar</button>
      </div>

      {/* Resumo financeiro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total em Vendas', value: `R$ ${totalVendas.toFixed(2)}`, color: '#16a34a' },
          { label: 'Total em Compras', value: `R$ ${totalCompras.toFixed(2)}`, color: '#2563eb' },
          { label: 'Saldo', value: `R$ ${(totalVendas - totalCompras).toFixed(2)}`, color: totalVendas - totalCompras >= 0 ? '#16a34a' : '#dc2626' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e5e7eb', borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.color, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Nova Movimentação</h2>
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
                  {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data *</label>
                <input style={input} type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
              {[
                { label: 'Valor (R$)', key: 'valor', type: 'number' },
                { label: 'Peso (kg)', key: 'peso_kg', type: 'number' },
                { label: 'Origem', key: 'origem', type: 'text' },
                { label: 'Destino', key: 'destino', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input style={input} type={f.type} step={f.type === 'number' ? '0.01' : undefined} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
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

      <div style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #e5e7eb', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Filtrar por tipo:</label>
        <select style={{ ...input, width: 200 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              {['Animal', 'Data', 'Tipo', 'Valor', 'Peso', 'Origem', 'Destino', 'Observações'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movs.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nenhuma movimentação registrada</td></tr>}
            {movs.map(m => {
              const a = animaisMap[m.animal_id]
              return (
                <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{a ? `#${a.brinco}` : `#${m.animal_id}`}</td>
                  <td style={{ padding: '12px 16px' }}>{new Date(m.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: (tipoColor[m.tipo] || '#6b7280') + '20', color: tipoColor[m.tipo] || '#6b7280', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                      {m.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: m.tipo === 'venda' ? '#16a34a' : '#374151' }}>
                    {m.valor != null ? `R$ ${m.valor.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{m.peso_kg ? `${m.peso_kg} kg` : '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{m.origem || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 13 }}>{m.destino || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>{m.observacoes || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
