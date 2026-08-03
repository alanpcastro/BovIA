import { useEffect, useState, FormEvent } from 'react'
import api, { Movimentacao, Animal } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { formatBRL, formatKg } from '../utils/format'
import { todayLocal } from '../utils/date'
import { apiErrorMessage } from '../utils/apiError'

const tipos = ['compra', 'venda', 'transferencia', 'nascimento', 'morte']
const tipoLabel: Record<string, string> = {
  compra: 'Compra', venda: 'Venda', transferencia: 'Transferência',
  nascimento: 'Nascimento', morte: 'Morte'
}
const tipoBadge: Record<string, string> = {
  compra: 'badge-blue', venda: 'badge-green', transferencia: 'badge-amber',
  nascimento: 'badge-pink', morte: 'badge-gray'
}

const emptyForm = {
  animal_id: '', tipo: 'compra',
  data: todayLocal(),
  valor: '', peso_kg: '', preco_arroba: '', agio_compra: '', frete: '', desconto: '', origem: '', destino: '', observacoes: ''
}

export default function Movimentacoes() {
  const { success, error: toastError } = useToast()
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [erro, setErro] = useState('')
  const [saving, setSaving] = useState(false)
  const [lotes, setLotes] = useState<any[]>([])
  const [showLoteModal, setShowLoteModal] = useState(false)
  const emptyLoteForm = { lote_id: '', tipo: 'compra', data: todayLocal(), valor_total: '', peso_medio_kg: '', origem: '', destino: '', observacoes: '' }
  const [loteForm, setLoteForm] = useState(emptyLoteForm)
  const [loteConfirm, setLoteConfirm] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.get('/animais', { params: { page_size: 200 } }).then(r => setAnimais(r.data.items))
    api.get('/lotes').then(r => setLotes(r.data))
  }, [])

  function load() {
    const p: any = {}
    if (filtroTipo) p.tipo = filtroTipo
    api.get('/movimentacoes', { params: p }).then(r => setMovs(r.data))
  }
  useEffect(load, [filtroTipo])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    try {
      await api.post('/movimentacoes', {
        animal_id: parseInt(form.animal_id), tipo: form.tipo, data: form.data,
        valor: form.valor ? parseFloat(form.valor) : undefined,
        peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : undefined,
        preco_arroba: form.preco_arroba ? parseFloat(form.preco_arroba) : undefined,
        agio_compra: form.agio_compra ? parseFloat(form.agio_compra) : undefined,
        frete: form.frete ? parseFloat(form.frete) : undefined,
        desconto: form.desconto ? parseFloat(form.desconto) : undefined,
        origem: form.origem || undefined, destino: form.destino || undefined,
        observacoes: form.observacoes || undefined
      })
      setShowModal(false)
      setForm(emptyForm)
      load()
      success('Movimentação registrada com sucesso!')
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao registrar'))
      toastError('Erro ao registrar movimentação')
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
      const res = await api.post(`/lotes/${loteForm.lote_id}/movimentacoes`, {
        tipo: loteForm.tipo, data: loteForm.data,
        valor_total: loteForm.valor_total ? parseFloat(loteForm.valor_total) : undefined,
        peso_medio_kg: loteForm.peso_medio_kg ? parseFloat(loteForm.peso_medio_kg) : undefined,
        origem: loteForm.origem || undefined, destino: loteForm.destino || undefined,
        observacoes: loteForm.observacoes || undefined,
      })
      setShowLoteModal(false)
      setLoteConfirm(false)
      load()
      success(`Movimentação registrada para ${res.data.registrados} animais!`)
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao registrar em lote'))
      toastError('Erro ao registrar movimentação em lote')
    } finally {
      setSaving(false)
    }
  }

  const animaisMap = Object.fromEntries(animais.map(a => [a.id, a]))

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAllVisible() {
    const visibleIds = movs.map(m => m.id)
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
    if (!confirm(`Excluir ${ids.length} movimentação(ões)?`)) return
    setSaving(true)
    try {
      const r = await api.post('/movimentacoes/bulk-delete', { ids })
      success(`${r.data.afetados} movimentação(ões) excluída(s)`)
      clearSelection()
      load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao excluir em massa'))
    } finally {
      setSaving(false)
    }
  }

  const totalVendas = movs.filter(m => m.tipo === 'venda').reduce((acc, m) => acc + (m.valor || 0), 0)
  const totalCompras = movs.filter(m => m.tipo === 'compra').reduce((acc, m) => acc + (m.valor || 0), 0)
  const saldo = totalVendas - totalCompras

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Movimentações</div>
          <div className="page-subtitle">Compras, vendas, nascimentos e outros eventos</div>
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

      {/* Resumo financeiro */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total em Vendas', value: formatBRL(totalVendas), color: 'var(--green-700)', bg: 'var(--green-100)' },
          { label: 'Total em Compras', value: formatBRL(totalCompras), color: 'var(--blue-600)', bg: 'var(--blue-100)' },
          { label: 'Saldo', value: formatBRL(saldo), color: saldo >= 0 ? 'var(--green-700)' : 'var(--red-600)', bg: saldo >= 0 ? 'var(--green-50)' : 'var(--red-100)' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-card-icon" style={{ background: c.bg }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={c.color} strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
              </svg>
            </div>
            <div>
              <div className="stat-card-label">{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color, marginTop: 2 }}>{c.value}</div>
            </div>
          </div>
        ))}
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
            {selectedIds.size} selecionada(s)
          </span>
          <button className="btn btn-ghost btn-sm" onClick={clearSelection}>Limpar</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-danger btn-sm" onClick={bulkDelete} disabled={saving}>Excluir selecionadas</button>
        </div>
      )}

      {/* Filtro por tipo */}
      <div className="filters-bar">
        <label className="filter-label">Filtrar por tipo:</label>
        <select className="form-select" style={{ width: 200 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos</option>
          {tipos.map(t => <option key={t} value={t}>{tipoLabel[t]}</option>)}
        </select>
      </div>

      {movs.length > 0 && (
        <label className="mobile-select-all">
          <input
            type="checkbox"
            aria-label="Selecionar todas as movimentações visíveis"
            checked={movs.length > 0 && movs.every(m => selectedIds.has(m.id))}
            ref={el => { if (el) { const some = movs.some(m => selectedIds.has(m.id)); const all = movs.length > 0 && movs.every(m => selectedIds.has(m.id)); el.indeterminate = some && !all } }}
            onChange={toggleAllVisible}
          />
          <span>Selecionar todas{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}</span>
        </label>
      )}

      <div className="table-wrapper table-wrapper-cards">
        <table className="data-table table-cards">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={movs.length > 0 && movs.every(m => selectedIds.has(m.id))}
                  onChange={toggleAllVisible}
                />
              </th>
              <th>Animal</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Peso</th>
              <th>@</th>
              <th>R$/kg</th>
              <th>Origem</th>
              <th>Destino</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {movs.length === 0 && (
              <tr><td colSpan={11} className="table-empty">Nenhuma movimentação registrada</td></tr>
            )}
            {movs.map(m => {
              const a = animaisMap[m.animal_id]
              return (
                <tr key={m.id} style={{ background: selectedIds.has(m.id) ? 'var(--green-50)' : undefined }}>
                  <td className="cell-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                    />
                  </td>
                  <td data-label="Animal" style={{ fontWeight: 600 }}>#{a ? a.brinco : m.animal_id}</td>
                  <td data-label="Data">{new Date(m.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td data-label="Tipo"><span className={`badge ${tipoBadge[m.tipo] || 'badge-gray'}`}>{tipoLabel[m.tipo] || m.tipo}</span></td>
                  <td data-label="Valor" style={{ fontWeight: 700, color: m.tipo === 'venda' ? 'var(--green-700)' : m.tipo === 'compra' ? 'var(--blue-600)' : 'var(--gray-700)' }}>
                    {m.valor != null ? formatBRL(m.valor) : '—'}
                  </td>
                  <td data-label="Peso" style={{ color: 'var(--gray-500)', fontSize: 13 }}>{m.peso_kg ? formatKg(m.peso_kg) : '—'}</td>
                  <td data-label="@" style={{ color: 'var(--amber-600)', fontSize: 13, fontWeight: 600 }}>{m.preco_arroba ? formatBRL(m.preco_arroba) : '—'}</td>
                  <td data-label="R$/kg" style={{ color: 'var(--gray-500)', fontSize: 13 }}>{m.custo_kg != null ? formatBRL(m.custo_kg) : '—'}</td>
                  <td data-label="Origem" style={{ color: 'var(--gray-500)', fontSize: 13 }}>{m.origem || '—'}</td>
                  <td data-label="Destino" style={{ color: 'var(--gray-500)', fontSize: 13 }}>{m.destino || '—'}</td>
                  <td data-label="Obs." style={{ color: 'var(--gray-400)', fontSize: 13 }}>{m.observacoes || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="table-footer">{movs.length} movimentação(ões)</div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Movimentação"
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-mov" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : 'Registrar'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        <form id="form-mov" onSubmit={handleSubmit}>
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
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Valor (R$)</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
            </div>
            <div className="form-group">
              <label className="form-label">Peso (kg)</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.1" value={form.peso_kg} onChange={e => setForm(f => ({ ...f, peso_kg: e.target.value }))} placeholder="Ex: 400" />
            </div>
            {(form.tipo === 'compra' || form.tipo === 'venda') && (
              <div className="form-group">
                <label className="form-label">Preco @ (R$)</label>
                <input className="form-input" type="number" inputMode="decimal" step="0.01" value={form.preco_arroba} onChange={e => setForm(f => ({ ...f, preco_arroba: e.target.value }))} placeholder="Ex: 320" />
              </div>
            )}
            {form.tipo === 'compra' && (
              <div className="form-group">
                <label className="form-label">Agil / Comissao (R$)</label>
                <input className="form-input" type="number" inputMode="decimal" step="0.01" value={form.agio_compra} onChange={e => setForm(f => ({ ...f, agio_compra: e.target.value }))} placeholder="Comissao do intermediario" />
              </div>
            )}
            {form.tipo === 'compra' && (
              <div className="form-group">
                <label className="form-label">Frete (R$)</label>
                <input className="form-input" type="number" inputMode="decimal" step="0.01" value={form.frete} onChange={e => setForm(f => ({ ...f, frete: e.target.value }))} placeholder="Frete do transporte" />
              </div>
            )}
            {form.tipo === 'venda' && (
              <div className="form-group">
                <label className="form-label">Desconto (R$)</label>
                <input className="form-input" type="number" inputMode="decimal" step="0.01" value={form.desconto} onChange={e => setForm(f => ({ ...f, desconto: e.target.value }))} placeholder="Desconto concedido" />
              </div>
            )}
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Origem</label>
              <input className="form-input" value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))} placeholder="Ex: Fazenda Boa Vista" />
            </div>
            <div className="form-group">
              <label className="form-label">Destino</label>
              <input className="form-input" value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} placeholder="Ex: Frigorífico ABC" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <input className="form-input" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional..." />
          </div>
        </form>
      </Modal>

      {/* Modal movimentação por lote */}
      <Modal
        open={showLoteModal}
        onClose={() => { setShowLoteModal(false); setLoteConfirm(false) }}
        title="Movimentação por Lote"
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setShowLoteModal(false); setLoteConfirm(false) }}>Cancelar</button>
            <button className="btn btn-primary" form="form-mov-lote" type="submit" disabled={saving}>
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
        <form id="form-mov-lote" onSubmit={handleLoteSubmit}>
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
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Valor total (R$)</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.01" value={loteForm.valor_total} onChange={e => setLoteForm(f => ({ ...f, valor_total: e.target.value }))} placeholder="Será dividido entre os animais" />
            </div>
            <div className="form-group">
              <label className="form-label">Peso médio (kg)</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.1" value={loteForm.peso_medio_kg} onChange={e => setLoteForm(f => ({ ...f, peso_medio_kg: e.target.value }))} placeholder="Ex: 400" />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Origem</label>
              <input className="form-input" value={loteForm.origem} onChange={e => setLoteForm(f => ({ ...f, origem: e.target.value }))} placeholder="Ex: Fazenda Boa Vista" />
            </div>
            <div className="form-group">
              <label className="form-label">Destino</label>
              <input className="form-input" value={loteForm.destino} onChange={e => setLoteForm(f => ({ ...f, destino: e.target.value }))} placeholder="Ex: Frigorífico ABC" />
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
