import { useEffect, useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { Animal, Lote } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

const statusLabel: Record<string, string> = {
  ativo: 'Ativo', vendido: 'Vendido', morto: 'Morto', transferido: 'Transferido'
}
const statusBadge: Record<string, string> = {
  ativo: 'badge-green', vendido: 'badge-blue', morto: 'badge-gray', transferido: 'badge-amber'
}

const emptyForm = {
  brinco: '', nome: '', raca: '', sexo: 'macho',
  data_nascimento: '', peso_entrada: '', origem: 'nascido', lote_id: '', observacoes: ''
}

export default function Animais() {
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const [animais, setAnimais] = useState<Animal[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filtros, setFiltros] = useState({ status: '', sexo: '', lote_id: '', busca: '' })
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function load() {
    const params = Object.fromEntries(
      Object.entries(filtros).filter(([k, v]) => v && k !== 'busca')
    )
    api.get('/animais', { params }).then(r => setAnimais(r.data))
  }

  useEffect(() => { api.get('/lotes').then(r => setLotes(r.data)) }, [])
  useEffect(load, [filtros.status, filtros.sexo, filtros.lote_id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSaving(true)
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
      setShowModal(false)
      setForm(emptyForm)
      load()
      success('Animal cadastrado com sucesso!')
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao cadastrar animal')
      toastError('Erro ao cadastrar animal')
    } finally {
      setSaving(false)
    }
  }

  const lotesMap = Object.fromEntries(lotes.map(l => [l.id, l.nome]))

  const animaisFiltrados = animais.filter(a => {
    if (!filtros.busca) return true
    const q = filtros.busca.toLowerCase()
    return (
      a.brinco.toLowerCase().includes(q) ||
      (a.nome?.toLowerCase().includes(q)) ||
      (a.raca?.toLowerCase().includes(q))
    )
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Animais</div>
          <div className="page-subtitle">{animais.length} animal(is) no rebanho</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setErro(''); setShowModal(true) }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Novo Animal
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-bar">
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="var(--gray-400)" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0014 13.828V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.172a1 1 0 00-.293-.707L1.293 6.707A1 1 0 011 6V4z"/>
        </svg>
        <input
          className="form-input"
          style={{ width: 200 }}
          placeholder="Buscar por brinco ou nome..."
          value={filtros.busca}
          onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))}
        />
        <select className="form-select" style={{ width: 'auto' }} value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="vendido">Vendido</option>
          <option value="morto">Morto</option>
          <option value="transferido">Transferido</option>
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filtros.sexo} onChange={e => setFiltros(f => ({ ...f, sexo: e.target.value }))}>
          <option value="">Todos os sexos</option>
          <option value="macho">♂ Macho</option>
          <option value="femea">♀ Fêmea</option>
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filtros.lote_id} onChange={e => setFiltros(f => ({ ...f, lote_id: e.target.value }))}>
          <option value="">Todos os lotes</option>
          {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Brinco</th>
              <th>Nome</th>
              <th>Raça</th>
              <th>Sexo</th>
              <th>Lote</th>
              <th>Peso Entrada</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {animaisFiltrados.length === 0 && (
              <tr><td colSpan={8} className="table-empty">Nenhum animal encontrado</td></tr>
            )}
            {animaisFiltrados.map(a => (
              <tr key={a.id} className="clickable" onClick={() => navigate(`/animais/${a.id}`)}>
                <td style={{ fontWeight: 700, color: 'var(--gray-900)' }}>#{a.brinco}</td>
                <td style={{ fontWeight: 500 }}>{a.nome || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                <td style={{ color: 'var(--gray-500)' }}>{a.raca || '—'}</td>
                <td>{a.sexo === 'macho' ? '♂ Macho' : '♀ Fêmea'}</td>
                <td style={{ color: 'var(--gray-500)' }}>{a.lote_id ? (lotesMap[a.lote_id] || '—') : '—'}</td>
                <td style={{ fontWeight: 500, color: 'var(--gray-700)' }}>{a.peso_entrada ? `${a.peso_entrada} kg` : '—'}</td>
                <td><span className={`badge ${statusBadge[a.status]}`}>{statusLabel[a.status]}</span></td>
                <td style={{ color: 'var(--green-700)', fontWeight: 600, fontSize: 12 }}>Ver →</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer">{animaisFiltrados.length} animal(is) exibido(s)</div>
      </div>

      {/* Modal de cadastro */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Cadastrar Novo Animal"
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-animal" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : 'Cadastrar Animal'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        <form id="form-animal" onSubmit={handleSubmit}>
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Brinco *</label>
              <input className="form-input" value={form.brinco} onChange={e => setForm(p => ({ ...p, brinco: e.target.value }))} required placeholder="Ex: 001" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="form-group">
              <label className="form-label">Raça</label>
              <input className="form-input" value={form.raca} onChange={e => setForm(p => ({ ...p, raca: e.target.value }))} placeholder="Ex: Nelore" />
            </div>
          </div>
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Sexo *</label>
              <select className="form-select" value={form.sexo} onChange={e => setForm(p => ({ ...p, sexo: e.target.value }))} required>
                <option value="macho">♂ Macho</option>
                <option value="femea">♀ Fêmea</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Origem</label>
              <select className="form-select" value={form.origem} onChange={e => setForm(p => ({ ...p, origem: e.target.value }))}>
                <option value="nascido">Nascido na fazenda</option>
                <option value="comprado">Comprado</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Lote</label>
              <select className="form-select" value={form.lote_id} onChange={e => setForm(p => ({ ...p, lote_id: e.target.value }))}>
                <option value="">Sem lote</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Data de Nascimento</label>
              <input className="form-input" type="date" value={form.data_nascimento} onChange={e => setForm(p => ({ ...p, data_nascimento: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Peso de Entrada (kg)</label>
              <input className="form-input" type="number" step="0.1" value={form.peso_entrada} onChange={e => setForm(p => ({ ...p, peso_entrada: e.target.value }))} placeholder="Ex: 280" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <input className="form-input" value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Opcional..." />
          </div>
        </form>
      </Modal>
    </div>
  )
}
