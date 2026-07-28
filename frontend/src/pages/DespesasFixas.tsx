import { useEffect, useState, FormEvent } from 'react'
import api, { DespesaFixa } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { formatBRL } from '../utils/format'
import { todayLocal } from '../utils/date'
import { apiErrorMessage } from '../utils/apiError'

const categorias = ['mao_de_obra', 'manutencao', 'energia', 'arrendamento', 'impostos', 'sal_mineral', 'suplemento', 'vermifugo', 'combustivel', 'outros']
const categoriaLabel: Record<string, string> = {
  mao_de_obra: 'Mao de Obra', manutencao: 'Manutencao', energia: 'Energia',
  arrendamento: 'Arrendamento', impostos: 'Impostos',
  sal_mineral: 'Sal Mineral', suplemento: 'Suplemento', vermifugo: 'Vermifugo',
  combustivel: 'Combustivel', outros: 'Outros'
}
const categoriaBadge: Record<string, string> = {
  mao_de_obra: 'badge-blue', manutencao: 'badge-amber', energia: 'badge-teal',
  arrendamento: 'badge-green', impostos: 'badge-red',
  sal_mineral: 'badge-amber', suplemento: 'badge-green', vermifugo: 'badge-pink',
  combustivel: 'badge-blue', outros: 'badge-gray'
}

const emptyForm = {
  categoria: 'mao_de_obra', descricao: '', valor_mensal: '',
  data_inicio: todayLocal(), data_fim: '', observacoes: ''
}

export default function DespesasFixas() {
  const { success, error: toastError } = useToast()
  const [despesas, setDespesas] = useState<DespesaFixa[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<DespesaFixa | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [erro, setErro] = useState('')
  const [saving, setSaving] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  function load() {
    const p: any = {}
    if (filtroCategoria) p.categoria = filtroCategoria
    api.get('/despesas-fixas', { params: p }).then(r => setDespesas(r.data))
  }

  useEffect(load, [filtroCategoria])

  function openNew() {
    setForm(emptyForm); setEditing(null); setErro(''); setShowModal(true)
  }

  function openEdit(d: DespesaFixa) {
    setEditing(d)
    setForm({
      categoria: d.categoria, descricao: d.descricao, valor_mensal: d.valor_mensal.toString(),
      data_inicio: d.data_inicio, data_fim: d.data_fim || '', observacoes: d.observacoes || ''
    })
    setErro(''); setShowModal(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(''); setSaving(true)
    const payload = {
      categoria: form.categoria,
      descricao: form.descricao,
      valor_mensal: parseFloat(form.valor_mensal),
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || undefined,
      observacoes: form.observacoes || undefined,
    }
    try {
      if (editing) {
        await api.put(`/despesas-fixas/${editing.id}`, payload)
        success('Despesa atualizada!')
      } else {
        await api.post('/despesas-fixas', payload)
        success('Despesa registrada!')
      }
      setShowModal(false); load()
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao salvar'))
      toastError('Erro ao salvar despesa')
    } finally { setSaving(false) }
  }

  async function deletar(id: number) {
    if (!confirm('Excluir esta despesa?')) return
    await api.delete(`/despesas-fixas/${id}`)
    load(); success('Despesa excluida')
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAllVisible() {
    const visibleIds = despesas.map(d => d.id)
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
    if (!confirm(`Excluir ${ids.length} despesa(s)?`)) return
    setSaving(true)
    try {
      const r = await api.post('/despesas-fixas/bulk-delete', { ids })
      success(`${r.data.afetados} despesa(s) excluída(s)`)
      clearSelection()
      load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao excluir em massa'))
    } finally {
      setSaving(false)
    }
  }

  const totalMensal = despesas.filter(d => !d.data_fim).reduce((s, d) => s + d.valor_mensal, 0)
  const totalImpostos = despesas.filter(d => !d.data_fim && d.categoria === 'impostos').reduce((s, d) => s + d.valor_mensal, 0)
  const totalOperacional = totalMensal - totalImpostos

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Despesas Fixas</div>
          <div className="page-subtitle">Custos operacionais, impostos e despesas recorrentes</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Nova Despesa
        </button>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card card-padded" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Total Mensal</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' }}>{formatBRL(totalMensal)}</div>
        </div>
        <div className="card card-padded" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Operacional</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber-600)' }}>{formatBRL(totalOperacional)}</div>
        </div>
        <div className="card card-padded" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 4 }}>Impostos</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--red-600)' }}>{formatBRL(totalImpostos)}</div>
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
        <label className="filter-label">Categoria:</label>
        <select className="form-select" style={{ width: 240 }} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas</option>
          {categorias.map(c => <option key={c} value={c}>{categoriaLabel[c]}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={despesas.length > 0 && despesas.every(d => selectedIds.has(d.id))}
                  onChange={toggleAllVisible}
                />
              </th>
              <th>Categoria</th>
              <th>Descricao</th>
              <th>Valor Mensal</th>
              <th>Inicio</th>
              <th>Fim</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {despesas.length === 0 && (
              <tr><td colSpan={7} className="table-empty">Nenhuma despesa cadastrada</td></tr>
            )}
            {despesas.map(d => (
              <tr key={d.id} style={{ background: selectedIds.has(d.id) ? 'var(--green-50)' : undefined }}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(d.id)}
                    onChange={() => toggleSelect(d.id)}
                  />
                </td>
                <td><span className={`badge ${categoriaBadge[d.categoria] || 'badge-gray'}`}>{categoriaLabel[d.categoria] || d.categoria}</span></td>
                <td style={{ fontWeight: 600 }}>{d.descricao}</td>
                <td style={{ fontWeight: 700, color: 'var(--red-600)' }}>{formatBRL(d.valor_mensal)}</td>
                <td style={{ fontSize: 13 }}>{new Date(d.data_inicio + 'T00:00').toLocaleDateString('pt-BR')}</td>
                <td style={{ fontSize: 13, color: d.data_fim ? 'var(--gray-600)' : 'var(--green-700)' }}>
                  {d.data_fim ? new Date(d.data_fim + 'T00:00').toLocaleDateString('pt-BR') : 'Vigente'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(d)} title="Editar">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                      </svg>
                    </button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => deletar(d.id)} title="Excluir">
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
        title={editing ? 'Editar Despesa' : 'Nova Despesa Fixa'}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-despesa" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : 'Salvar'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        <form id="form-despesa" onSubmit={handleSubmit}>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Categoria *</label>
              <select className="form-select" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} required>
                {categorias.map(c => <option key={c} value={c}>{categoriaLabel[c]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Valor Mensal (R$) *</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.01" value={form.valor_mensal} onChange={e => setForm(p => ({ ...p, valor_mensal: e.target.value }))} required placeholder="Ex: 3500" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descricao *</label>
            <input className="form-input" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} required placeholder="Ex: Funcionario - Vaqueiro" />
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
        </form>
      </Modal>
    </div>
  )
}
