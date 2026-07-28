import { useEffect, useState, FormEvent } from 'react'
import api, { CustoNutricional, Lote } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { formatBRL, formatKg } from '../utils/format'
import { todayLocal } from '../utils/date'
import { apiErrorMessage } from '../utils/apiError'

const emptyForm = {
  lote_id: '', produto: '', preco_kg: '', consumo_kg_dia: '',
  data_inicio: todayLocal(), data_fim: '', observacoes: ''
}

export default function CustosNutricionais() {
  const { success, error: toastError } = useToast()
  const [custos, setCustos] = useState<CustoNutricional[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CustoNutricional | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [erro, setErro] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtroLote, setFiltroLote] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  function load() {
    const p: any = {}
    if (filtroLote) p.lote_id = filtroLote
    api.get('/custos-nutricionais', { params: p }).then(r => setCustos(r.data))
  }

  useEffect(() => { api.get('/lotes').then(r => setLotes(r.data)) }, [])
  useEffect(load, [filtroLote])

  function openNew() {
    setForm(emptyForm); setEditing(null); setErro(''); setShowModal(true)
  }

  function openEdit(c: CustoNutricional) {
    setEditing(c)
    setForm({
      lote_id: c.lote_id?.toString() || '', produto: c.produto,
      preco_kg: c.preco_kg.toString(), consumo_kg_dia: c.consumo_kg_dia.toString(),
      data_inicio: c.data_inicio, data_fim: c.data_fim || '', observacoes: c.observacoes || ''
    })
    setErro(''); setShowModal(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(''); setSaving(true)
    const payload = {
      lote_id: form.lote_id ? parseInt(form.lote_id) : null,
      produto: form.produto,
      preco_kg: parseFloat(form.preco_kg),
      consumo_kg_dia: parseFloat(form.consumo_kg_dia),
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || undefined,
      observacoes: form.observacoes || undefined,
    }
    try {
      if (editing) {
        await api.put(`/custos-nutricionais/${editing.id}`, payload)
        success('Custo atualizado!')
      } else {
        await api.post('/custos-nutricionais', payload)
        success('Custo nutricional registrado!')
      }
      setShowModal(false); load()
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao salvar'))
      toastError('Erro ao salvar custo')
    } finally { setSaving(false) }
  }

  async function deletar(id: number) {
    if (!confirm('Excluir este custo nutricional?')) return
    await api.delete(`/custos-nutricionais/${id}`)
    load(); success('Custo excluído')
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAllVisible() {
    const visibleIds = custos.map(c => c.id)
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
    if (!confirm(`Excluir ${ids.length} custo(s)?`)) return
    setSaving(true)
    try {
      const r = await api.post('/custos-nutricionais/bulk-delete', { ids })
      success(`${r.data.afetados} custo(s) excluído(s)`)
      clearSelection()
      load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao excluir em massa'))
    } finally {
      setSaving(false)
    }
  }

  const custoTotal = custos.reduce((s, c) => s + (c.custo_diario_cab || 0), 0)
  const lotesMap = Object.fromEntries(lotes.map(l => [l.id, l.nome]))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Custos Nutricionais</div>
          <div className="page-subtitle">Ração, sal mineral e suplementos</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Novo Custo
        </button>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card card-padded" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Produtos Cadastrados</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' }}>{custos.length}</div>
        </div>
        <div className="card card-padded" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Custo Diario / Cab</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber-600)' }}>{formatBRL(custoTotal)}</div>
        </div>
        <div className="card card-padded" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Custo Mensal / Cab</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--red-600)' }}>{formatBRL(custoTotal * 30)}</div>
        </div>
      </div>

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

      {/* Filtro */}
      <div className="filters-bar">
        <label className="filter-label">Filtrar por lote:</label>
        <select className="form-select" style={{ width: 240 }} value={filtroLote} onChange={e => setFiltroLote(e.target.value)}>
          <option value="">Todos</option>
          {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={custos.length > 0 && custos.every(c => selectedIds.has(c.id))}
                  onChange={toggleAllVisible}
                />
              </th>
              <th>Produto</th>
              <th>Lote</th>
              <th>R$/kg</th>
              <th>kg/dia/cab</th>
              <th>Custo/dia/cab</th>
              <th>Inicio</th>
              <th>Fim</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {custos.length === 0 && (
              <tr><td colSpan={9} className="table-empty">Nenhum custo nutricional cadastrado</td></tr>
            )}
            {custos.map(c => (
              <tr key={c.id} style={{ background: selectedIds.has(c.id) ? 'var(--green-50)' : undefined }}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                  />
                </td>
                <td style={{ fontWeight: 600 }}>{c.produto}</td>
                <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{c.lote_id ? lotesMap[c.lote_id] || `#${c.lote_id}` : 'Geral'}</td>
                <td>{formatBRL(c.preco_kg)}</td>
                <td>{formatKg(c.consumo_kg_dia, 2)}</td>
                <td style={{ fontWeight: 700, color: 'var(--amber-600)' }}>{formatBRL(c.custo_diario_cab || 0)}</td>
                <td style={{ fontSize: 13 }}>{new Date(c.data_inicio + 'T00:00').toLocaleDateString('pt-BR')}</td>
                <td style={{ fontSize: 13, color: c.data_fim ? 'var(--gray-600)' : 'var(--green-700)' }}>
                  {c.data_fim ? new Date(c.data_fim + 'T00:00').toLocaleDateString('pt-BR') : 'Vigente'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(c)} title="Editar">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                      </svg>
                    </button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => deletar(c.id)} title="Excluir">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Editar Custo Nutricional' : 'Novo Custo Nutricional'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-custo-nutri" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : 'Salvar'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        <form id="form-custo-nutri" onSubmit={handleSubmit}>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Produto *</label>
              <input className="form-input" value={form.produto} onChange={e => setForm(p => ({ ...p, produto: e.target.value }))} required placeholder="Ex: Ração Engorda 22%" />
            </div>
            <div className="form-group">
              <label className="form-label">Lote</label>
              <select className="form-select" value={form.lote_id} onChange={e => setForm(p => ({ ...p, lote_id: e.target.value }))}>
                <option value="">Geral (toda fazenda)</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Preco por kg (R$) *</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.01" value={form.preco_kg} onChange={e => setForm(p => ({ ...p, preco_kg: e.target.value }))} required placeholder="Ex: 2.50" />
            </div>
            <div className="form-group">
              <label className="form-label">Consumo kg/dia/cab *</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.1" value={form.consumo_kg_dia} onChange={e => setForm(p => ({ ...p, consumo_kg_dia: e.target.value }))} required placeholder="Ex: 12" />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Data Inicio *</label>
              <input className="form-input" type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Data Fim</label>
              <input className="form-input" type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observacoes</label>
            <input className="form-input" value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Opcional..." />
          </div>
          {form.preco_kg && form.consumo_kg_dia && (
            <div style={{ padding: '10px 14px', background: 'var(--amber-100)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--amber-800)', fontWeight: 600 }}>
              Custo diario por cabeca: {formatBRL(parseFloat(form.preco_kg || '0') * parseFloat(form.consumo_kg_dia || '0'))}
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
