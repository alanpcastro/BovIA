import { useEffect, useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api, { Pesagem, Animal } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { formatKg, formatNumber } from '../utils/format'
import { todayLocal } from '../utils/date'
import { apiErrorMessage } from '../utils/apiError'

export default function Pesagens() {
  const [params] = useSearchParams()
  const animalIdParam = params.get('animal_id')
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()

  const [pesagens, setPesagens] = useState<Pesagem[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [showModal, setShowModal] = useState(!!animalIdParam)
  const [filtroAnimal, setFiltroAnimal] = useState(animalIdParam || '')
  const [form, setForm] = useState({
    animal_id: animalIdParam || '',
    data: todayLocal(),
    peso_kg: '', observacoes: ''
  })
  const [erro, setErro] = useState('')
  const [saving, setSaving] = useState(false)
  const [lotes, setLotes] = useState<any[]>([])
  const [showLoteModal, setShowLoteModal] = useState(false)
  const [loteForm, setLoteForm] = useState({ lote_id: '', data: todayLocal(), peso_medio_kg: '', observacoes: '' })
  const [loteConfirm, setLoteConfirm] = useState(false)
  const [selectedPesagemIds, setSelectedPesagemIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.get('/animais', { params: { status: 'ativo', page_size: 200 } }).then(r => {
      const sorted = [...r.data.items].sort((a, b) => {
        const aNum = parseInt(a.brinco ?? '')
        const bNum = parseInt(b.brinco ?? '')
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
        return (a.brinco ?? '').localeCompare(b.brinco ?? '')
      })
      setAnimais(sorted)
    })
    api.get('/lotes').then(r => setLotes(r.data))
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
    setSaving(true)
    try {
      await api.post('/pesagens', {
        animal_id: parseInt(form.animal_id),
        data: form.data,
        peso_kg: parseFloat(form.peso_kg),
        observacoes: form.observacoes || undefined
      })
      setForm(f => ({ ...f, peso_kg: '', observacoes: '' }))
      setShowModal(false)
      load()
      success('Pesagem registrada com sucesso!')
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao registrar pesagem'))
      toastError('Erro ao registrar pesagem')
    } finally {
      setSaving(false)
    }
  }

  async function handleLoteSubmit(e: FormEvent) {
    e.preventDefault()
    if (!loteConfirm) {
      setLoteConfirm(true)
      return
    }
    setErro('')
    setSaving(true)
    try {
      const res = await api.post(`/lotes/${loteForm.lote_id}/pesagens`, {
        data: loteForm.data,
        peso_medio_kg: parseFloat(loteForm.peso_medio_kg),
        observacoes: loteForm.observacoes || undefined,
      })
      setShowLoteModal(false)
      setLoteConfirm(false)
      load()
      success(`Pesagem registrada para ${res.data.registrados} animais!`)
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao registrar pesagem em lote'))
      toastError('Erro ao registrar pesagem em lote')
    } finally {
      setSaving(false)
    }
  }

  const animaisMap = Object.fromEntries(animais.map(a => [a.id, a]))

  function toggleSelectPesagem(pesagemId: number) {
    setSelectedPesagemIds(prev => {
      const next = new Set(prev)
      if (next.has(pesagemId)) next.delete(pesagemId); else next.add(pesagemId)
      return next
    })
  }
  function toggleAllVisible() {
    const visibleIds = pesagens.map(p => p.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedPesagemIds.has(id))
    setSelectedPesagemIds(prev => {
      const next = new Set(prev)
      if (allSelected) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => next.add(id))
      return next
    })
  }
  function clearSelection() { setSelectedPesagemIds(new Set()) }
  async function bulkDeletePesagens() {
    const pesagem_ids = Array.from(selectedPesagemIds)
    if (pesagem_ids.length === 0) return
    if (!confirm(`Excluir ${pesagem_ids.length} pesagem(ns) selecionada(s)?`)) return
    setSaving(true)
    try {
      const r = await api.post('/pesagens/bulk-delete', { pesagem_ids })
      success(`${r.data.afetados} pesagem(ns) excluída(s)`)
      clearSelection()
      load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao excluir em massa'))
    } finally {
      setSaving(false)
    }
  }

  async function deletarPesagem(pesagemId: number) {
    if (!confirm('Excluir esta pesagem?')) return
    try {
      await api.delete(`/pesagens/${pesagemId}`)
      success('Pesagem excluída')
      load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao excluir pesagem'))
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Pesagens</div>
          <div className="page-subtitle">Controle de peso e GMD do rebanho</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-xl" onClick={() => { setLoteForm({ lote_id: '', data: todayLocal(), peso_medio_kg: '', observacoes: '' }); setErro(''); setLoteConfirm(false); setShowLoteModal(true) }}>
            Pesar Lote Inteiro
          </button>
          <button className="btn btn-primary btn-xl" onClick={() => { setErro(''); setShowModal(true) }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5 5 0 006.9 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.9 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V6"/>
            </svg>
            Registrar Pesagem
          </button>
        </div>
      </div>

      {selectedPesagemIds.size > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '12px 16px', marginBottom: 16, borderRadius: 'var(--radius)',
            background: 'var(--green-50)', border: '1px solid var(--green-100)',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--green-800)' }}>
            {selectedPesagemIds.size} pesagem(ns) selecionada(s)
          </span>
          <button className="btn btn-ghost btn-sm" onClick={clearSelection}>Limpar</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-danger btn-sm" onClick={bulkDeletePesagens} disabled={saving}>
            Excluir selecionadas
          </button>
        </div>
      )}

      {/* Filtro */}
      <div className="filters-bar">
        <label className="filter-label">Filtrar por animal:</label>
        <select className="form-select" style={{ width: 280 }} value={filtroAnimal} onChange={e => setFiltroAnimal(e.target.value)}>
          <option value="">Todos os animais</option>
          {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
        </select>
      </div>

      {/* Estado vazio: primeira vez usando pesagens */}
      {pesagens.length === 0 && !filtroAnimal && (
        <div className="card card-padded" style={{ textAlign: 'center', padding: 48 }}>
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="var(--green-700)" strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5 5 0 006.9 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.9 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V6"/>
          </svg>
          <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 6 }}>Nenhuma pesagem registrada</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', maxWidth: 380, margin: '0 auto 20px' }}>
            {animais.length === 0
              ? 'Antes de registrar uma pesagem, cadastre pelo menos um animal.'
              : 'Registre o peso individual de um animal ou aplique um peso médio a todo um lote de uma vez.'}
          </div>
          {animais.length === 0 ? (
            <button className="btn btn-primary" onClick={() => navigate('/animais')}>
              Cadastrar animais primeiro
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => { setErro(''); setShowModal(true) }}>
                Registrar primeira pesagem
              </button>
              <button className="btn btn-ghost" onClick={() => { setLoteForm({ lote_id: '', data: todayLocal(), peso_medio_kg: '', observacoes: '' }); setErro(''); setLoteConfirm(false); setShowLoteModal(true) }}>
                Pesar Lote Inteiro
              </button>
            </div>
          )}
        </div>
      )}

      <div className="table-wrapper" style={pesagens.length === 0 && !filtroAnimal ? { display: 'none' } : undefined}>
        <table className="data-table data-table-big">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={pesagens.length > 0 && pesagens.every(p => selectedPesagemIds.has(p.id))}
                  onChange={toggleAllVisible}
                />
              </th>
              <th>Animal</th>
              <th>Data</th>
              <th>Peso (kg)</th>
              <th>GMD (kg/dia)</th>
              <th>Observações</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pesagens.length === 0 && filtroAnimal && (
              <tr><td colSpan={7} className="table-empty">
                Nenhuma pesagem para o animal selecionado.{' '}
                <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setFiltroAnimal('')}>
                  Ver todas
                </button>
              </td></tr>
            )}
            {pesagens.map(p => {
              const animal = animaisMap[p.animal_id]
              const gmdPositivo = p.gmd != null && p.gmd > 0
              const gmdNegativo = p.gmd != null && p.gmd < 0
              const isSelected = selectedPesagemIds.has(p.id)
              return (
                <tr
                  key={p.id}
                  style={{ background: isSelected ? 'var(--green-50)' : undefined }}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectPesagem(p.id)}
                    />
                  </td>
                  <td
                    style={{ fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => navigate(`/animais/${p.animal_id}`)}
                  >
                    #{animal?.brinco || p.animal_id}
                    {animal?.nome && <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}> — {animal.nome}</span>}
                  </td>
                  <td>{new Date(p.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ fontWeight: 700, color: 'var(--green-700)' }}>{formatKg(p.peso_kg, 1)}</td>
                  <td>
                    {p.gmd != null ? (
                      <span style={{
                        fontWeight: 700,
                        color: gmdPositivo ? 'var(--green-700)' : gmdNegativo ? 'var(--red-600)' : 'var(--gray-500)'
                      }}>
                        {gmdPositivo ? '+' : ''}{formatNumber(p.gmd, 3)} kg/dia
                      </span>
                    ) : <span style={{ color: 'var(--gray-400)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--gray-600)', fontSize: 13, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.observacoes || '—'}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => deletarPesagem(p.id)}
                      title="Excluir esta pesagem"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--red-600)" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="table-footer">
          {pesagens.length} pesagem(ns) no total
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Pesagem"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-pesagem" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : 'Registrar'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        <form id="form-pesagem" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Animal *</label>
            <select className="form-select" value={form.animal_id} onChange={e => setForm(f => ({ ...f, animal_id: e.target.value }))} required autoFocus>
              <option value="">Selecione um animal...</option>
              {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
            </select>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input className="form-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Peso (kg) *</label>
              <input className="form-input" type="number" step="0.1" value={form.peso_kg} onChange={e => setForm(f => ({ ...f, peso_kg: e.target.value }))} required placeholder="Ex: 320" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <input className="form-input" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional..." />
          </div>
        </form>
      </Modal>

      {/* Modal pesagem por lote */}
      <Modal
        open={showLoteModal}
        onClose={() => { setShowLoteModal(false); setLoteConfirm(false) }}
        title="Pesagem por Lote"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setShowLoteModal(false); setLoteConfirm(false) }}>Cancelar</button>
            <button className="btn btn-primary" form="form-pesagem-lote" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : loteConfirm ? 'Confirmar' : 'Registrar'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        {loteConfirm && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            <span style={{ lineHeight: 1.5 }}>
              Isso vai registrar pesagem para <strong>todos os animais</strong> do lote <strong>{lotes.find(l => String(l.id) === loteForm.lote_id)?.nome}</strong> ({lotes.find(l => String(l.id) === loteForm.lote_id)?.total_animais} animais). Confirmar?
            </span>
          </div>
        )}
        <form id="form-pesagem-lote" onSubmit={handleLoteSubmit}>
          <div className="form-group">
            <label className="form-label">Lote *</label>
            <select className="form-select" value={loteForm.lote_id} onChange={e => setLoteForm(f => ({ ...f, lote_id: e.target.value }))} required>
              <option value="">Selecione um lote...</option>
              {lotes.map(l => <option key={l.id} value={l.id}>{l.nome} ({l.total_animais} animais)</option>)}
            </select>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input className="form-input" type="date" value={loteForm.data} onChange={e => setLoteForm(f => ({ ...f, data: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Peso médio (kg) *</label>
              <input className="form-input" type="number" step="0.1" value={loteForm.peso_medio_kg} onChange={e => setLoteForm(f => ({ ...f, peso_medio_kg: e.target.value }))} required placeholder="Ex: 320" />
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
