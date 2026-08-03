import { useEffect, useState, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { Saude as SaudeType, Animal } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { formatBRL } from '../utils/format'
import { todayLocal } from '../utils/date'
import { apiErrorMessage } from '../utils/apiError'

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
  data: todayLocal(),
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
  const [lotes, setLotes] = useState<any[]>([])
  const [showLoteModal, setShowLoteModal] = useState(false)
  const emptyLoteForm = { lote_id: '', tipo: 'vacinacao', data: todayLocal(), descricao: '', medicamento: '', dose: '', custo_total: '', responsavel: '', proxima_data: '', observacoes: '' }
  const [loteForm, setLoteForm] = useState(emptyLoteForm)
  const [loteConfirm, setLoteConfirm] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.get('/animais', { params: { status: 'ativo', page_size: 200 } }).then(r => setAnimais(r.data.items))
    api.get('/lotes').then(r => setLotes(r.data))
  }, [])
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
      setErro(apiErrorMessage(err, 'Erro ao registrar'))
      toastError('Erro ao salvar registro de saúde')
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
      const res = await api.post(`/lotes/${loteForm.lote_id}/saude`, {
        tipo: loteForm.tipo, data: loteForm.data, descricao: loteForm.descricao,
        medicamento: loteForm.medicamento || undefined, dose: loteForm.dose || undefined,
        custo_total: loteForm.custo_total ? parseFloat(loteForm.custo_total) : undefined,
        responsavel: loteForm.responsavel || undefined,
        proxima_data: loteForm.proxima_data || undefined,
        observacoes: loteForm.observacoes || undefined,
      })
      setShowLoteModal(false)
      setLoteConfirm(false)
      load()
      success(`Saúde registrada para ${res.data.registrados} animais!`)
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao registrar em lote'))
      toastError('Erro ao registrar saúde em lote')
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

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAllVisible() {
    const visibleIds = registrosFiltrados.map(r => r.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => next.add(id))
      return next
    })
  }
  function clearSelection() { setSelectedIds(new Set()) }
  async function bulkDelete() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`Excluir ${ids.length} registro(s)?`)) return
    setSaving(true)
    try {
      const r = await api.post('/saude/bulk-delete', { ids })
      success(`${r.data.afetados} registro(s) excluído(s)`)
      clearSelection()
      load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao excluir em massa'))
    } finally {
      setSaving(false)
    }
  }

  // Resumo de custos
  const totalCustos = registros.reduce((acc, r) => acc + (r.custo || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Saúde do Rebanho</div>
          <div className="page-subtitle">
            {registros.length} registro(s) · Custo total: <strong style={{ color: totalCustos > 0 ? 'var(--red-600)' : 'var(--gray-500)' }}>{formatBRL(totalCustos)}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-xl" onClick={() => { setLoteForm(emptyLoteForm); setErro(''); setLoteConfirm(false); setShowLoteModal(true) }}>
            Vacinar Lote Inteiro
          </button>
          <button className="btn btn-primary btn-xl" onClick={() => { setErro(''); setForm(emptyForm); setShowModal(true) }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
            Vacinar / Tratar
          </button>
        </div>
      </div>

      {/* Barra de seleção em massa */}
      {selectedIds.size > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '12px 16px', marginBottom: 16, borderRadius: 'var(--radius)',
            background: 'var(--green-50)', border: '1px solid var(--green-100)',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--green-800)' }}>
            {selectedIds.size} selecionado(s)
          </span>
          <button className="btn btn-ghost btn-sm" onClick={clearSelection}>Limpar</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-danger btn-sm" onClick={bulkDelete} disabled={saving}>Excluir selecionados</button>
        </div>
      )}

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

      {registrosFiltrados.length > 0 && (
        <label className="mobile-select-all">
          <input
            type="checkbox"
            aria-label="Selecionar todos os registros visíveis"
            checked={registrosFiltrados.length > 0 && registrosFiltrados.every(r => selectedIds.has(r.id))}
            ref={el => { if (el) { const some = registrosFiltrados.some(r => selectedIds.has(r.id)); const all = registrosFiltrados.length > 0 && registrosFiltrados.every(r => selectedIds.has(r.id)); el.indeterminate = some && !all } }}
            onChange={toggleAllVisible}
          />
          <span>Selecionar todos{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}</span>
        </label>
      )}

      <div className="table-wrapper table-wrapper-cards">
        <table className="data-table data-table-big table-cards">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={registrosFiltrados.length > 0 && registrosFiltrados.every(r => selectedIds.has(r.id))}
                  onChange={toggleAllVisible}
                />
              </th>
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
              <tr><td colSpan={9} className="table-empty">Nenhum registro encontrado</td></tr>
            )}
            {registrosFiltrados.map(s => {
              const a = animaisMap[s.animal_id]
              const vencendo = s.proxima_data && Math.ceil((new Date(s.proxima_data + 'T00:00').getTime() - Date.now()) / 86400000) <= 7
              return (
                <tr key={s.id} style={{ background: selectedIds.has(s.id) ? 'var(--green-50)' : undefined }}>
                  <td className="cell-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                    />
                  </td>
                  <td data-label="Animal" style={{ fontWeight: 600 }}>#{a ? a.brinco : s.animal_id}</td>
                  <td data-label="Data">{new Date(s.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td data-label="Tipo"><span className={`badge ${tipoBadge[s.tipo] || 'badge-gray'}`}>{tipoLabel[s.tipo] || s.tipo}</span></td>
                  <td data-label="Descrição" style={{ maxWidth: 200 }}>{s.descricao}</td>
                  <td data-label="Medicamento" style={{ color: 'var(--gray-500)', fontSize: 13 }}>{s.medicamento || '—'}</td>
                  <td data-label="Custo" style={{ fontWeight: 600, color: s.custo ? 'var(--red-600)' : 'var(--gray-400)' }}>
                    {s.custo != null ? formatBRL(s.custo) : '—'}
                  </td>
                  <td data-label="Próxima">
                    {s.proxima_data ? (
                      <span style={{ fontWeight: 600, color: vencendo ? 'var(--red-600)' : 'var(--amber-600)', fontSize: 13 }}>
                        {new Date(s.proxima_data + 'T00:00').toLocaleDateString('pt-BR')}
                        {vencendo && <span className="badge badge-red" style={{ marginLeft: 4, fontSize: 10 }}>!</span>}
                      </span>
                    ) : <span style={{ color: 'var(--gray-400)' }}>—</span>}
                  </td>
                  <td className="cell-actions">
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
              <input className="form-input" type="number" inputMode="decimal" step="0.01" value={form.custo} onChange={e => setForm(f => ({ ...f, custo: e.target.value }))} placeholder="0,00" />
            </div>
            <div className="form-group">
              <label className="form-label">Próxima Data</label>
              <input className="form-input" type="date" value={form.proxima_data} onChange={e => setForm(f => ({ ...f, proxima_data: e.target.value }))} />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal saúde por lote */}
      <Modal
        open={showLoteModal}
        onClose={() => { setShowLoteModal(false); setLoteConfirm(false) }}
        title="Saúde por Lote"
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setShowLoteModal(false); setLoteConfirm(false) }}>Cancelar</button>
            <button className="btn btn-primary" form="form-saude-lote" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : loteConfirm ? 'Confirmar' : 'Registrar'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        {loteConfirm && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            Isso vai registrar para <strong>todos os animais</strong> do lote <strong>{lotes.find(l => String(l.id) === loteForm.lote_id)?.nome}</strong> ({lotes.find(l => String(l.id) === loteForm.lote_id)?.total_animais} animais). Confirmar?
          </div>
        )}
        <form id="form-saude-lote" onSubmit={handleLoteSubmit}>
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
          <div className="form-group">
            <label className="form-label">Descrição *</label>
            <input className="form-input" value={loteForm.descricao} onChange={e => setLoteForm(f => ({ ...f, descricao: e.target.value }))} required placeholder="Ex: Vacina contra febre aftosa" />
          </div>
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Medicamento</label>
              <input className="form-input" value={loteForm.medicamento} onChange={e => setLoteForm(f => ({ ...f, medicamento: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Dose</label>
              <input className="form-input" value={loteForm.dose} onChange={e => setLoteForm(f => ({ ...f, dose: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Responsável</label>
              <input className="form-input" value={loteForm.responsavel} onChange={e => setLoteForm(f => ({ ...f, responsavel: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Custo total (R$)</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.01" value={loteForm.custo_total} onChange={e => setLoteForm(f => ({ ...f, custo_total: e.target.value }))} placeholder="Será dividido entre os animais" />
            </div>
            <div className="form-group">
              <label className="form-label">Próxima Data</label>
              <input className="form-input" type="date" value={loteForm.proxima_data} onChange={e => setLoteForm(f => ({ ...f, proxima_data: e.target.value }))} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
