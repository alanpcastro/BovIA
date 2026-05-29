import { useEffect, useState, FormEvent, useMemo } from 'react'
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

  // Agrupa pesagens por animal: pega a mais recente + total de pesagens
  // (Pesagens vêm ordenadas DESC pela API, entao a primeira de cada animal e a mais recente)
  const resumoPorAnimal = useMemo(() => {
    const map = new Map<number, { latest: Pesagem; total: number }>()
    for (const p of pesagens) {
      const existing = map.get(p.animal_id)
      if (existing) {
        existing.total += 1
      } else {
        map.set(p.animal_id, { latest: p, total: 1 })
      }
    }
    return Array.from(map.values())
  }, [pesagens])

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

      {/* Filtro */}
      <div className="filters-bar">
        <label className="filter-label">Filtrar por animal:</label>
        <select className="form-select" style={{ width: 280 }} value={filtroAnimal} onChange={e => setFiltroAnimal(e.target.value)}>
          <option value="">Todos os animais</option>
          {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table data-table-big">
          <thead>
            <tr>
              <th>Animal</th>
              <th>Última Pesagem</th>
              <th>Peso Atual</th>
              <th>GMD (kg/dia)</th>
              <th>Pesagens</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {resumoPorAnimal.length === 0 && (
              <tr><td colSpan={6} className="table-empty">Nenhuma pesagem registrada</td></tr>
            )}
            {resumoPorAnimal.map(({ latest: p, total }) => {
              const animal = animaisMap[p.animal_id]
              const gmdPositivo = p.gmd != null && p.gmd > 0
              const gmdNegativo = p.gmd != null && p.gmd < 0
              return (
                <tr
                  key={p.animal_id}
                  onClick={() => navigate(`/animais/${p.animal_id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 600 }}>
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
                  <td>
                    <span className="badge badge-gray" style={{ fontWeight: 700 }}>
                      {total} {total === 1 ? 'registro' : 'registros'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--gray-400)', fontSize: 12, fontWeight: 600 }}>
                    Ver histórico →
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="table-footer">
          {resumoPorAnimal.length} animal(is) com pesagem · {pesagens.length} pesagem(ns) no total
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
