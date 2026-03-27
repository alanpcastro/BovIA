import { useEffect, useState, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { Saude as SaudeType, Animal } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

const tipos = ['vacinacao', 'vermifugacao', 'tratamento', 'exame', 'cirurgia']

const tipoLabel: Record<string, string> = {
  vacinacao: 'Vacinação', vermifugacao: 'Vermifugação',
  tratamento: 'Tratamento', exame: 'Exame', cirurgia: 'Cirurgia'
}

const tipoBadge: Record<string, string> = {
  vacinacao: 'badge-pink', vermifugacao: 'badge-teal',
  tratamento: 'badge-amber', exame: 'badge-blue', cirurgia: 'badge-red'
}

const emptyForm = {
  animal_id: '', tipo: 'vacinacao',
  data: new Date().toISOString().split('T')[0],
  descricao: '', medicamento: '', dose: '',
  custo: '', responsavel: '', proxima_data: '', observacoes: ''
}

export default function Saude() {
  const [params] = useSearchParams()
  const animalIdParam = params.get('animal_id')
  const { success, error: toastError } = useToast()

  const [registros, setRegistros] = useState<SaudeType[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [showModal, setShowModal] = useState(!!animalIdParam)
  const [filtroAnimal, setFiltroAnimal] = useState(animalIdParam || '')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [form, setForm] = useState({ ...emptyForm, animal_id: animalIdParam || '' })
  const [erro, setErro] = useState('')
  const [saving, setSaving] = useState(false)

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
    setSaving(true)
    try {
      await api.post('/saude', {
        animal_id: parseInt(form.animal_id), tipo: form.tipo, data: form.data,
        descricao: form.descricao,
        medicamento: form.medicamento || undefined, dose: form.dose || undefined,
        custo: form.custo ? parseFloat(form.custo) : undefined,
        responsavel: form.responsavel || undefined,
        proxima_data: form.proxima_data || undefined,
        observacoes: form.observacoes || undefined
      })
      setShowModal(false)
      setForm(emptyForm)
      load()
      success('Registro de saúde salvo com sucesso!')
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao registrar')
      toastError('Erro ao salvar registro de saúde')
    } finally {
      setSaving(false)
    }
  }

  async function deletar(id: number) {
    if (!confirm('Excluir este registro?')) return
    await api.delete(`/saude/${id}`)
    load()
    success('Registro excluído')
  }

  const animaisMap = Object.fromEntries(animais.map(a => [a.id, a]))

  const registrosFiltrados = registros.filter(r => !filtroTipo || r.tipo === filtroTipo)

  // Resumo de custos
  const totalCustos = registros.reduce((acc, r) => acc + (r.custo || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Saúde do Rebanho</div>
          <div className="page-subtitle">
            {registros.length} registro(s) · Custo total: <strong style={{ color: 'var(--red-600)' }}>R$ {totalCustos.toFixed(2)}</strong>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setErro(''); setForm(emptyForm); setShowModal(true) }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Registrar
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-bar">
        <label className="filter-label">Animal:</label>
        <select className="form-select" style={{ width: 240 }} value={filtroAnimal} onChange={e => setFiltroAnimal(e.target.value)}>
          <option value="">Todos</option>
          {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
        </select>
        <label className="filter-label">Tipo:</label>
        <select className="form-select" style={{ width: 160 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos</option>
          {tipos.map(t => <option key={t} value={t}>{tipoLabel[t]}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Animal</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Medicamento</th>
              <th>Custo</th>
              <th>Próxima Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {registrosFiltrados.length === 0 && (
              <tr><td colSpan={8} className="table-empty">Nenhum registro encontrado</td></tr>
            )}
            {registrosFiltrados.map(s => {
              const a = animaisMap[s.animal_id]
              const vencendo = s.proxima_data && Math.ceil((new Date(s.proxima_data + 'T00:00').getTime() - Date.now()) / 86400000) <= 7
              return (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>#{a ? a.brinco : s.animal_id}</td>
                  <td>{new Date(s.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td><span className={`badge ${tipoBadge[s.tipo] || 'badge-gray'}`}>{tipoLabel[s.tipo] || s.tipo}</span></td>
                  <td style={{ maxWidth: 200 }}>{s.descricao}</td>
                  <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{s.medicamento || '—'}</td>
                  <td style={{ fontWeight: 600, color: s.custo ? 'var(--red-600)' : 'var(--gray-400)' }}>
                    {s.custo != null ? `R$ ${s.custo.toFixed(2)}` : '—'}
                  </td>
                  <td>
                    {s.proxima_data ? (
                      <span style={{ fontWeight: 600, color: vencendo ? 'var(--red-600)' : 'var(--amber-600)', fontSize: 13 }}>
                        {new Date(s.proxima_data + 'T00:00').toLocaleDateString('pt-BR')}
                        {vencendo && <span className="badge badge-red" style={{ marginLeft: 4, fontSize: 10 }}>!</span>}
                      </span>
                    ) : <span style={{ color: 'var(--gray-400)' }}>—</span>}
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => deletar(s.id)}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="table-footer">{registrosFiltrados.length} registro(s)</div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Ocorrência de Saúde"
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-saude" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : 'Registrar'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        <form id="form-saude" onSubmit={handleSubmit}>
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Animal *</label>
              <select className="form-select" value={form.animal_id} onChange={e => setForm(f => ({ ...f, animal_id: e.target.value }))} required autoFocus>
                <option value="">Selecione...</option>
                {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo *</label>
              <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} required>
                {tipos.map(t => <option key={t} value={t}>{tipoLabel[t]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input className="form-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição *</label>
            <input className="form-input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} required placeholder="Ex: Vacina contra febre aftosa" />
          </div>
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Medicamento</label>
              <input className="form-input" value={form.medicamento} onChange={e => setForm(f => ({ ...f, medicamento: e.target.value }))} placeholder="Nome do medicamento" />
            </div>
            <div className="form-group">
              <label className="form-label">Dose</label>
              <input className="form-input" value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} placeholder="Ex: 5ml" />
            </div>
            <div className="form-group">
              <label className="form-label">Responsável</label>
              <input className="form-input" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável" />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Custo (R$)</label>
              <input className="form-input" type="number" step="0.01" value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))} placeholder="0,00" />
            </div>
            <div className="form-group">
              <label className="form-label">Próxima Data</label>
              <input className="form-input" type="date" value={form.proxima_data} onChange={e => setForm(f => ({ ...f, proxima_data: e.target.value }))} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
