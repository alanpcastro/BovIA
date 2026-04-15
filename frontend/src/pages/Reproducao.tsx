import { useEffect, useState, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { Reproducao as ReproducaoType, Animal } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

const tipos = ['cobertura_natural', 'inseminacao', 'transferencia_embriao', 'parto']
const tipoLabel: Record<string, string> = {
  cobertura_natural: 'Cobertura Natural',
  inseminacao: 'Inseminação',
  transferencia_embriao: 'Transf. Embrião',
  parto: 'Parto'
}
const resultados = ['prenha', 'vazia', 'nasceu bezerro', 'aborto']
const resultadoLabel: Record<string, string> = {
  prenha: 'Prenha', vazia: 'Vazia', 'nasceu bezerro': 'Nasceu bezerro', aborto: 'Aborto'
}
const resultadoBadge: Record<string, string> = {
  prenha: 'badge-green', vazia: 'badge-gray', 'nasceu bezerro': 'badge-pink', aborto: 'badge-red'
}

const emptyForm = {
  animal_id: '', tipo: 'inseminacao',
  data: new Date().toISOString().split('T')[0],
  touro_brinco: '', resultado: '', data_prevista_parto: '', bezerro_brinco: '', observacoes: ''
}

export default function Reproducao() {
  const [params] = useSearchParams()
  const animalIdParam = params.get('animal_id')
  const { success, error: toastError } = useToast()

  const [registros, setRegistros] = useState<ReproducaoType[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [showModal, setShowModal] = useState(!!animalIdParam)
  const [filtroAnimal, setFiltroAnimal] = useState(animalIdParam || '')
  const [form, setForm] = useState({ ...emptyForm, animal_id: animalIdParam || '' })
  const [erro, setErro] = useState('')
  const [saving, setSaving] = useState(false)
  const [lotes, setLotes] = useState<any[]>([])
  const [showLoteModal, setShowLoteModal] = useState(false)
  const emptyLoteForm = { lote_id: '', tipo: 'inseminacao', data: new Date().toISOString().split('T')[0], touro_brinco: '', resultado: '', data_prevista_parto: '', observacoes: '' }
  const [loteForm, setLoteForm] = useState(emptyLoteForm)
  const [loteConfirm, setLoteConfirm] = useState(false)

  useEffect(() => {
    api.get('/animais', { params: { sexo: 'femea', page_size: 200 } }).then(r => setAnimais(r.data.items))
    api.get('/lotes').then(r => setLotes(r.data))
  }, [])
  function load() {
    const p: any = {}
    if (filtroAnimal) p.animal_id = filtroAnimal
    api.get('/reproducao', { params: p }).then(r => setRegistros(r.data))
  }
  useEffect(load, [filtroAnimal])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    try {
      await api.post('/reproducao', {
        animal_id: parseInt(form.animal_id), tipo: form.tipo, data: form.data,
        touro_brinco: form.touro_brinco || undefined,
        resultado: form.resultado || undefined,
        data_prevista_parto: form.data_prevista_parto || undefined,
        bezerro_brinco: form.bezerro_brinco || undefined,
        observacoes: form.observacoes || undefined
      })
      setShowModal(false)
      setForm(emptyForm)
      load()
      success('Registro reprodutivo salvo!')
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao registrar')
      toastError('Erro ao salvar registro reprodutivo')
    } finally {
      setSaving(false)
    }
  }

  async function handleLoteSubmit(e: FormEvent) {
    e.preventDefault()
    if (!loteConfirm) { setLoteConfirm(true); return }
    setErro('')
    setSaving(true)
    try {
      const res = await api.post(`/lotes/${loteForm.lote_id}/reproducao`, {
        tipo: loteForm.tipo, data: loteForm.data,
        touro_brinco: loteForm.touro_brinco || undefined,
        resultado: loteForm.resultado || undefined,
        data_prevista_parto: loteForm.data_prevista_parto || undefined,
        observacoes: loteForm.observacoes || undefined,
      })
      setShowLoteModal(false)
      setLoteConfirm(false)
      load()
      success(`Reprodução registrada para ${res.data.registrados} animais!`)
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao registrar em lote')
      toastError('Erro ao registrar reprodução em lote')
    } finally {
      setSaving(false)
    }
  }

  async function deletar(id: number) {
    if (!confirm('Excluir este registro?')) return
    await api.delete(`/reproducao/${id}`)
    load()
    success('Registro excluído')
  }

  const animaisMap = Object.fromEntries(animais.map(a => [a.id, a]))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reprodução</div>
          <div className="page-subtitle">Controle de cobertura, inseminação e partos</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => { setLoteForm(emptyLoteForm); setErro(''); setLoteConfirm(false); setShowLoteModal(true) }}>
            Por Lote
          </button>
          <button className="btn btn-primary" onClick={() => { setErro(''); setForm(emptyForm); setShowModal(true) }}>
            + Registrar
          </button>
        </div>
      </div>

      {/* Filtro */}
      <div className="filters-bar">
        <label className="filter-label">Animal (fêmea):</label>
        <select className="form-select" style={{ width: 260 }} value={filtroAnimal} onChange={e => setFiltroAnimal(e.target.value)}>
          <option value="">Todos</option>
          {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Animal</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Resultado</th>
              <th>Touro</th>
              <th>Parto Previsto</th>
              <th>Bezerro</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 && (
              <tr><td colSpan={8} className="table-empty">Nenhum registro encontrado</td></tr>
            )}
            {registros.map(r => {
              const a = animaisMap[r.animal_id]
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>#{a ? a.brinco : r.animal_id}</td>
                  <td>{new Date(r.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td><span className="badge badge-teal">{tipoLabel[r.tipo] || r.tipo}</span></td>
                  <td>
                    {r.resultado
                      ? <span className={`badge ${resultadoBadge[r.resultado] || 'badge-gray'}`}>{resultadoLabel[r.resultado] || r.resultado}</span>
                      : <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Pendente</span>
                    }
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{r.touro_brinco ? `#${r.touro_brinco}` : '—'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--green-700)', fontSize: 13 }}>
                    {r.data_prevista_parto ? new Date(r.data_prevista_parto + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{r.bezerro_brinco ? `#${r.bezerro_brinco}` : '—'}</td>
                  <td>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => deletar(r.id)}>
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
        <div className="table-footer">{registros.length} registro(s)</div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Evento Reprodutivo"
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-repro" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : 'Registrar'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        <form id="form-repro" onSubmit={handleSubmit}>
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Fêmea *</label>
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
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Brinco do Touro</label>
              <input className="form-input" value={form.touro_brinco} onChange={e => setForm(f => ({ ...f, touro_brinco: e.target.value }))} placeholder="Ex: T-001" />
            </div>
            <div className="form-group">
              <label className="form-label">Resultado</label>
              <select className="form-select" value={form.resultado} onChange={e => setForm(f => ({ ...f, resultado: e.target.value }))}>
                <option value="">Pendente</option>
                {resultados.map(r => <option key={r} value={r}>{resultadoLabel[r]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Previsão de Parto</label>
              <input className="form-input" type="date" value={form.data_prevista_parto} onChange={e => setForm(f => ({ ...f, data_prevista_parto: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Brinco do Bezerro</label>
              <input className="form-input" value={form.bezerro_brinco} onChange={e => setForm(f => ({ ...f, bezerro_brinco: e.target.value }))} placeholder="Após nascimento" />
            </div>
            <div className="form-group">
              <label className="form-label">Observações</label>
              <input className="form-input" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional..." />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal reprodução por lote */}
      <Modal
        open={showLoteModal}
        onClose={() => { setShowLoteModal(false); setLoteConfirm(false) }}
        title="Reprodução por Lote"
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setShowLoteModal(false); setLoteConfirm(false) }}>Cancelar</button>
            <button className="btn btn-primary" form="form-repro-lote" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : loteConfirm ? 'Confirmar' : 'Registrar'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        {loteConfirm && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            Isso vai registrar para <strong>todas as femeas</strong> do lote <strong>{lotes.find(l => String(l.id) === loteForm.lote_id)?.nome}</strong> ({lotes.find(l => String(l.id) === loteForm.lote_id)?.total_animais} animais). Confirmar?
          </div>
        )}
        <form id="form-repro-lote" onSubmit={handleLoteSubmit}>
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Lote *</label>
              <select className="form-select" value={loteForm.lote_id} onChange={e => setLoteForm(f => ({ ...f, lote_id: e.target.value }))} required>
                <option value="">Selecione...</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nome} ({l.total_animais} animais)</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo *</label>
              <select className="form-select" value={loteForm.tipo} onChange={e => setLoteForm(f => ({ ...f, tipo: e.target.value }))} required>
                {tipos.map(t => <option key={t} value={t}>{tipoLabel[t]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input className="form-input" type="date" value={loteForm.data} onChange={e => setLoteForm(f => ({ ...f, data: e.target.value }))} required />
            </div>
          </div>
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Brinco do Touro</label>
              <input className="form-input" value={loteForm.touro_brinco} onChange={e => setLoteForm(f => ({ ...f, touro_brinco: e.target.value }))} placeholder="Ex: T-001" />
            </div>
            <div className="form-group">
              <label className="form-label">Resultado</label>
              <select className="form-select" value={loteForm.resultado} onChange={e => setLoteForm(f => ({ ...f, resultado: e.target.value }))}>
                <option value="">Pendente</option>
                {resultados.map(r => <option key={r} value={r}>{resultadoLabel[r]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Previsão de Parto</label>
              <input className="form-input" type="date" value={loteForm.data_prevista_parto} onChange={e => setLoteForm(f => ({ ...f, data_prevista_parto: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <input className="form-input" value={loteForm.observacoes} onChange={e => setLoteForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional..." />
          </div>
        </form>
      </Modal>
    </div>
  )
}
