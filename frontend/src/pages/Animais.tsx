import { useEffect, useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { Animal, Lote } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { formatKg } from '../utils/format'
import { todayLocal } from '../utils/date'
import { apiErrorMessage } from '../utils/apiError'

const statusLabel: Record<string, string> = {
  ativo: 'Ativo', vendido: 'Vendido', morto: 'Morto', transferido: 'Transferido'
}
const statusBadge: Record<string, string> = {
  ativo: 'badge-green', vendido: 'badge-blue', morto: 'badge-gray', transferido: 'badge-amber'
}

const categorias = ['bezerro', 'garrote', 'novilha', 'vaca', 'boi_magro', 'boi_gordo'] as const
const categoriaLabel: Record<string, string> = {
  bezerro: 'Bezerro', garrote: 'Garrote', novilha: 'Novilha',
  vaca: 'Vaca', boi_magro: 'Boi Magro', boi_gordo: 'Boi Gordo'
}
const categoriaBadge: Record<string, string> = {
  bezerro: 'badge-blue', garrote: 'badge-teal', novilha: 'badge-pink',
  vaca: 'badge-amber', boi_magro: 'badge-gray', boi_gordo: 'badge-green'
}

const emptyForm = {
  brinco: '', nome: '', raca: '', sexo: 'femea', categoria: '',
  data_nascimento: '', peso_entrada: '', origem: 'nascido', lote_id: '', observacoes: '',
  // Compra (movimentação)
  registrar_compra: false,
  compra_valor: '', compra_preco_arroba: '', compra_origem: '',
  // Vacinação (saúde)
  registrar_vacina: false,
  vacina_descricao: '', vacina_medicamento: '', vacina_proxima_data: '',
}

export default function Animais() {
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const [animais, setAnimais] = useState<Animal[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [lotes, setLotes] = useState<Lote[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filtros, setFiltros] = useState({ status: 'ativo', sexo: '', categoria: '', lote_id: '', busca: '' })
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [showLoteModal, setShowLoteModal] = useState(false)
  const [loteForm, setLoteForm] = useState({ lote_id: '', quantidade: '', raca: '', sexo: 'femea', peso_medio: '', origem: 'nascido', observacoes: '', brinco_prefixo: '', brinco_inicio: '1' })

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction] = useState<'' | 'lote' | 'status' | 'categoria' | 'delete'>('')
  const [bulkLoteId, setBulkLoteId] = useState<string>('')
  const [bulkStatus, setBulkStatus] = useState<string>('')
  const [bulkCategoria, setBulkCategoria] = useState<string>('')

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    const visibleIds = animais.map(a => a.id)
    const allSelected = visibleIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id))
      } else {
        visibleIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function executarBulk() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setSaving(true)
    try {
      if (bulkAction === 'delete') {
        const r = await api.post('/animais/bulk-delete', { ids })
        success(`${r.data.afetados} animal(is) excluído(s)`)
      } else {
        const payload: any = { ids }
        if (bulkAction === 'lote') payload.lote_id = bulkLoteId ? parseInt(bulkLoteId) : 0
        if (bulkAction === 'status') payload.status = bulkStatus
        if (bulkAction === 'categoria') payload.categoria = bulkCategoria
        const r = await api.post('/animais/bulk-update', payload)
        success(`${r.data.afetados} animal(is) atualizado(s)`)
      }
      setBulkAction('')
      setBulkLoteId(''); setBulkStatus(''); setBulkCategoria('')
      clearSelection()
      load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro na operação em massa'))
    } finally {
      setSaving(false)
    }
  }

  function load(p = page) {
    const params: Record<string, string | number> = { page: p, page_size: pageSize }
    if (filtros.status) params.status = filtros.status
    if (filtros.sexo) params.sexo = filtros.sexo
    if (filtros.categoria) params.categoria = filtros.categoria
    if (filtros.lote_id) params.lote_id = filtros.lote_id
    if (filtros.busca) params.busca = filtros.busca
    api.get('/animais', { params }).then(r => {
      setAnimais(r.data.items)
      setTotal(r.data.total)
    })
  }

  useEffect(() => { api.get('/lotes').then(r => setLotes(r.data)) }, [])
  useEffect(() => { setPage(1); load(1) }, [filtros.status, filtros.sexo, filtros.categoria, filtros.lote_id, filtros.busca])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    const payload = {
      brinco: form.brinco || undefined,
      nome: form.nome || undefined,
      raca: form.raca || undefined,
      sexo: form.sexo,
      categoria: form.categoria || undefined,
      data_nascimento: form.data_nascimento || undefined,
      peso_entrada: form.peso_entrada ? parseFloat(form.peso_entrada) : undefined,
      origem: form.origem || undefined,
      lote_id: form.lote_id ? parseInt(form.lote_id) : undefined,
      observacoes: form.observacoes || undefined,
    }
    try {
      const res = await api.post('/animais', payload)
      const animalId = res.data.id
      const hoje = todayLocal()
      const falhasExtras: string[] = []
      // Register purchase if checked
      if (form.registrar_compra && form.compra_valor) {
        try {
          await api.post('/movimentacoes', {
            animal_id: animalId, tipo: 'compra', data: hoje,
            valor: parseFloat(form.compra_valor),
            peso_kg: form.peso_entrada ? parseFloat(form.peso_entrada) : undefined,
            preco_arroba: form.compra_preco_arroba ? parseFloat(form.compra_preco_arroba) : undefined,
            origem: form.compra_origem || undefined,
          })
        } catch (err: any) {
          falhasExtras.push(`Compra: ${apiErrorMessage(err, 'falha ao registrar')}`)
        }
      }
      // Register vaccination if checked
      if (form.registrar_vacina && form.vacina_descricao) {
        try {
          await api.post('/saude', {
            animal_id: animalId, tipo: 'vacinacao', data: hoje,
            descricao: form.vacina_descricao,
            medicamento: form.vacina_medicamento || undefined,
            proxima_data: form.vacina_proxima_data || undefined,
          })
        } catch (err: any) {
          falhasExtras.push(`Vacinação: ${apiErrorMessage(err, 'falha ao registrar')}`)
        }
      }
      setShowModal(false)
      setForm(emptyForm)
      load()
      if (falhasExtras.length > 0) {
        success('Animal cadastrado, mas com pendências')
        falhasExtras.forEach(msg => toastError(msg))
      } else {
        success('Animal cadastrado com sucesso!')
      }
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao cadastrar animal'))
      toastError('Erro ao cadastrar animal')
    } finally {
      setSaving(false)
    }
  }

  async function handleLoteSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    try {
      const res = await api.post(`/lotes/${loteForm.lote_id}/animais`, {
        quantidade: parseInt(loteForm.quantidade),
        raca: loteForm.raca || undefined,
        sexo: loteForm.sexo,
        peso_medio: loteForm.peso_medio ? parseFloat(loteForm.peso_medio) : undefined,
        origem: loteForm.origem || undefined,
        observacoes: loteForm.observacoes || undefined,
        brinco_prefixo: loteForm.brinco_prefixo.trim() || undefined,
        brinco_inicio: parseInt(loteForm.brinco_inicio) || 1,
      })
      setShowLoteModal(false)
      load()
      success(`${res.data.criados} animais criados no lote ${res.data.lote}!`)
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao criar animais em lote'))
      toastError('Erro ao criar animais em lote')
    } finally {
      setSaving(false)
    }
  }

  const lotesMap = Object.fromEntries(lotes.map(l => [l.id, l.nome]))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Animais</div>
          <div className="page-subtitle">{total} animal(is) no rebanho</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-xl" onClick={() => { setLoteForm({ lote_id: '', quantidade: '', raca: '', sexo: 'macho', peso_medio: '', origem: 'nascido', observacoes: '', brinco_prefixo: '', brinco_inicio: '1' }); setErro(''); setShowLoteModal(true) }}>
            Criar em Lote
          </button>
          <button className="btn btn-primary btn-xl" onClick={() => { setForm(emptyForm); setErro(''); setShowModal(true) }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Cadastrar Animal
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
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
          <button className="btn btn-outline btn-sm" onClick={() => { setBulkLoteId(''); setBulkAction('lote') }}>Mover de lote</button>
          <button className="btn btn-outline btn-sm" onClick={() => { setBulkStatus(''); setBulkAction('status') }}>Mudar status</button>
          <button className="btn btn-outline btn-sm" onClick={() => { setBulkCategoria(''); setBulkAction('categoria') }}>Mudar categoria</button>
          <button className="btn btn-danger btn-sm" onClick={() => setBulkAction('delete')}>Excluir</button>
        </div>
      )}

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
        <select className="form-select" style={{ width: 'auto' }} value={filtros.categoria} onChange={e => setFiltros(f => ({ ...f, categoria: e.target.value }))}>
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{categoriaLabel[c]}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filtros.lote_id} onChange={e => setFiltros(f => ({ ...f, lote_id: e.target.value }))}>
          <option value="">Todos os lotes</option>
          {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="table-wrapper">
        <table className="data-table data-table-big">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os animais visíveis"
                  checked={animais.length > 0 && animais.every(a => selectedIds.has(a.id))}
                  ref={el => {
                    if (el) {
                      const visible = animais.map(a => a.id)
                      const some = visible.some(id => selectedIds.has(id))
                      const all = visible.length > 0 && visible.every(id => selectedIds.has(id))
                      el.indeterminate = some && !all
                    }
                  }}
                  onChange={toggleAllVisible}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
              </th>
              <th>Brinco</th>
              <th>Nome</th>
              <th>Raça</th>
              <th>Sexo</th>
              <th>Categoria</th>
              <th>Lote</th>
              <th>Peso Entrada</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {animais.length === 0 && (
              <tr><td colSpan={10} className="table-empty" style={{ fontSize: 16, padding: 56 }}>Nenhum animal encontrado</td></tr>
            )}
            {animais.map(a => (
              <tr key={a.id} className="clickable" onClick={() => navigate(`/animais/${a.id}`)} style={selectedIds.has(a.id) ? { background: 'var(--green-50)' } : undefined}>
                <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar animal ${a.brinco || a.id}`}
                    checked={selectedIds.has(a.id)}
                    onChange={() => toggleSelect(a.id)}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                </td>
                <td style={{ fontWeight: 800, color: 'var(--gray-900)' }}>{a.brinco ? `#${a.brinco}` : <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                <td style={{ fontWeight: 600 }}>{a.nome || <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                <td style={{ color: 'var(--gray-600)' }}>{a.raca || '—'}</td>
                <td style={{ fontWeight: 600 }}>{a.sexo === 'macho' ? 'Macho' : 'Fêmea'}</td>
                <td>{a.categoria ? <span className={`badge ${categoriaBadge[a.categoria]}`}>{categoriaLabel[a.categoria]}</span> : <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                <td style={{ color: 'var(--gray-600)' }}>{a.lote_id ? (lotesMap[a.lote_id] || '—') : '—'}</td>
                <td style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{a.peso_entrada != null ? formatKg(a.peso_entrada) : '—'}</td>
                <td><span className={`badge ${statusBadge[a.status]}`} style={{ fontSize: 13, padding: '5px 12px' }}>{statusLabel[a.status]}</span></td>
                <td style={{ color: 'var(--green-700)', fontWeight: 700, fontSize: 14 }}>Ver →</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{total} animal(is) no total</span>
          {total > pageSize && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => { setPage(p => p - 1); load(page - 1) }}>← Anterior</button>
              <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Página {page} de {Math.ceil(total / pageSize)}</span>
              <button className="btn btn-ghost btn-sm" disabled={page * pageSize >= total} onClick={() => { setPage(p => p + 1); load(page + 1) }}>Próxima →</button>
            </div>
          )}
        </div>
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
              <label className="form-label">Brinco</label>
              <input className="form-input" value={form.brinco} onChange={e => setForm(p => ({ ...p, brinco: e.target.value }))} placeholder="Ex: 001" autoFocus />
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
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Data de Nascimento</label>
              <input className="form-input" type="date" value={form.data_nascimento} onChange={e => setForm(p => ({ ...p, data_nascimento: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Peso de Entrada (kg)</label>
              <input className="form-input" type="number" step="0.1" value={form.peso_entrada} onChange={e => setForm(p => ({ ...p, peso_entrada: e.target.value }))} placeholder="Ex: 280" />
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-select" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                <option value="">Selecionar</option>
                {categorias.map(c => <option key={c} value={c}>{categoriaLabel[c]}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <input className="form-input" value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Opcional..." />
          </div>

          {/* Compra (optional section) */}
          <div style={{ borderTop: '1px solid var(--gray-200)', marginTop: 12, paddingTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
              <input type="checkbox" checked={form.registrar_compra} onChange={e => setForm(p => ({ ...p, registrar_compra: e.target.checked }))} />
              Registrar compra junto
            </label>
            {form.registrar_compra && (
              <div className="grid-3" style={{ marginTop: 12, marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Valor (R$)</label>
                  <input className="form-input" type="number" step="0.01" value={form.compra_valor} onChange={e => setForm(p => ({ ...p, compra_valor: e.target.value }))} placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Preco @ (R$)</label>
                  <input className="form-input" type="number" step="0.01" value={form.compra_preco_arroba} onChange={e => setForm(p => ({ ...p, compra_preco_arroba: e.target.value }))} placeholder="Ex: 320" />
                </div>
                <div className="form-group">
                  <label className="form-label">Origem</label>
                  <input className="form-input" value={form.compra_origem} onChange={e => setForm(p => ({ ...p, compra_origem: e.target.value }))} placeholder="Ex: Fazenda X" />
                </div>
              </div>
            )}
          </div>

          {/* Vacinação (optional section) */}
          <div style={{ borderTop: '1px solid var(--gray-200)', marginTop: 12, paddingTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
              <input type="checkbox" checked={form.registrar_vacina} onChange={e => setForm(p => ({ ...p, registrar_vacina: e.target.checked }))} />
              Registrar vacinacao junto
            </label>
            {form.registrar_vacina && (
              <div className="grid-3" style={{ marginTop: 12, marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Descricao *</label>
                  <input className="form-input" value={form.vacina_descricao} onChange={e => setForm(p => ({ ...p, vacina_descricao: e.target.value }))} placeholder="Ex: Aftosa" />
                </div>
                <div className="form-group">
                  <label className="form-label">Medicamento</label>
                  <input className="form-input" value={form.vacina_medicamento} onChange={e => setForm(p => ({ ...p, vacina_medicamento: e.target.value }))} placeholder="Nome" />
                </div>
                <div className="form-group">
                  <label className="form-label">Proxima data</label>
                  <input className="form-input" type="date" value={form.vacina_proxima_data} onChange={e => setForm(p => ({ ...p, vacina_proxima_data: e.target.value }))} />
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Modal criar em lote */}
      <Modal
        open={showLoteModal}
        onClose={() => setShowLoteModal(false)}
        title="Criar Animais em Lote"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowLoteModal(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-animal-lote" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Criando...</> : 'Criar Animais'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        <form id="form-animal-lote" onSubmit={handleLoteSubmit}>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Lote *</label>
              <select className="form-select" value={loteForm.lote_id} onChange={e => setLoteForm(p => ({ ...p, lote_id: e.target.value }))} required>
                <option value="">Selecione um lote...</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantidade de cabeças *</label>
              <input className="form-input" type="number" min="1" value={loteForm.quantidade} onChange={e => setLoteForm(p => ({ ...p, quantidade: e.target.value }))} required placeholder="Ex: 50" />
            </div>
          </div>
          <div className="grid-3" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Raça</label>
              <input className="form-input" value={loteForm.raca} onChange={e => setLoteForm(p => ({ ...p, raca: e.target.value }))} placeholder="Ex: Nelore" />
            </div>
            <div className="form-group">
              <label className="form-label">Sexo</label>
              <select className="form-select" value={loteForm.sexo} onChange={e => setLoteForm(p => ({ ...p, sexo: e.target.value }))}>
                <option value="macho">Macho</option>
                <option value="femea">Fêmea</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Peso médio (kg)</label>
              <input className="form-input" type="number" step="0.1" value={loteForm.peso_medio} onChange={e => setLoteForm(p => ({ ...p, peso_medio: e.target.value }))} placeholder="Ex: 320" />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Origem</label>
              <select className="form-select" value={loteForm.origem} onChange={e => setLoteForm(p => ({ ...p, origem: e.target.value }))}>
                <option value="nascido">Nascido na fazenda</option>
                <option value="comprado">Comprado</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Observações</label>
              <input className="form-input" value={loteForm.observacoes} onChange={e => setLoteForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Opcional..." />
            </div>
          </div>

          {/* Numeracao automatica de brincos */}
          <div style={{ borderTop: '1px solid var(--gray-200)', marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8 }}>
              Numeração automática de brincos (opcional)
            </div>
            <div className="grid-2" style={{ marginBottom: 0 }}>
              <div className="form-group">
                <label className="form-label">Prefixo do brinco</label>
                <input
                  className="form-input"
                  value={loteForm.brinco_prefixo}
                  onChange={e => setLoteForm(p => ({ ...p, brinco_prefixo: e.target.value }))}
                  placeholder="Ex: L1-"
                  maxLength={20}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Número inicial</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  value={loteForm.brinco_inicio}
                  onChange={e => setLoteForm(p => ({ ...p, brinco_inicio: e.target.value }))}
                />
              </div>
            </div>
            {loteForm.brinco_prefixo.trim() && loteForm.quantidade && parseInt(loteForm.quantidade) > 0 && (() => {
              const inicio = parseInt(loteForm.brinco_inicio) || 1
              const qtd = parseInt(loteForm.quantidade)
              const ultimo = inicio + qtd - 1
              const padding = Math.max(3, String(ultimo).length)
              const pad = (n: number) => String(n).padStart(padding, '0')
              const primeiro = `${loteForm.brinco_prefixo.trim()}${pad(inicio)}`
              const fim = `${loteForm.brinco_prefixo.trim()}${pad(ultimo)}`
              return (
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                  Serão gerados: <strong>{primeiro}</strong> até <strong>{fim}</strong>
                </div>
              )
            })()}
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>
              Deixe o prefixo em branco para criar animais sem brinco.
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal de operacao em massa */}
      <Modal
        open={bulkAction !== ''}
        onClose={() => setBulkAction('')}
        title={
          bulkAction === 'delete' ? 'Excluir animais selecionados'
          : bulkAction === 'lote' ? 'Mover para outro lote'
          : bulkAction === 'status' ? 'Mudar status'
          : bulkAction === 'categoria' ? 'Mudar categoria'
          : ''
        }
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setBulkAction('')}>Cancelar</button>
            <button
              className={bulkAction === 'delete' ? 'btn btn-danger' : 'btn btn-primary'}
              onClick={executarBulk}
              disabled={
                saving
                || (bulkAction === 'status' && !bulkStatus)
                || (bulkAction === 'categoria' && !bulkCategoria)
              }
            >
              {saving ? <><span className="spinner" /> Aplicando...</>
                : bulkAction === 'delete' ? `Excluir ${selectedIds.size} animal(is)`
                : 'Aplicar'}
            </button>
          </>
        }
      >
        {bulkAction === 'delete' && (
          <div>
            <p style={{ marginBottom: 12 }}>
              Você está prestes a excluir <strong>{selectedIds.size}</strong> animal(is) <strong>permanentemente</strong>.
            </p>
            <p style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 12 }}>
              Todas as pesagens, eventos de saúde, registros reprodutivos e movimentações desses animais serão apagados junto.
            </p>
            <div style={{ padding: 10, background: 'var(--amber-100)', borderRadius: 6, fontSize: 12, color: 'var(--amber-800)' }}>
              ⚠️ Se algum foi vendido/morreu, use <strong>Mudar status</strong> em vez de excluir — preserva histórico financeiro.
            </div>
          </div>
        )}
        {bulkAction === 'lote' && (
          <div className="form-group">
            <label className="form-label">Novo lote para {selectedIds.size} animal(is)</label>
            <select className="form-select" value={bulkLoteId} onChange={e => setBulkLoteId(e.target.value)}>
              <option value="">— Sem lote —</option>
              {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
              Selecione "Sem lote" para remover do lote atual.
            </div>
          </div>
        )}
        {bulkAction === 'status' && (
          <div className="form-group">
            <label className="form-label">Novo status para {selectedIds.size} animal(is) *</label>
            <select className="form-select" value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} required>
              <option value="">Selecione...</option>
              <option value="ativo">Ativo</option>
              <option value="vendido">Vendido</option>
              <option value="morto">Morto</option>
              <option value="transferido">Transferido</option>
            </select>
            {(bulkStatus === 'vendido' || bulkStatus === 'morto') && (
              <div style={{ fontSize: 12, color: 'var(--amber-600)', marginTop: 8, padding: '8px 12px', background: 'var(--amber-100)', borderRadius: 6 }}>
                Será criada uma movimentação automática de {bulkStatus} para cada animal.
              </div>
            )}
          </div>
        )}
        {bulkAction === 'categoria' && (
          <div className="form-group">
            <label className="form-label">Nova categoria para {selectedIds.size} animal(is) *</label>
            <select className="form-select" value={bulkCategoria} onChange={e => setBulkCategoria(e.target.value)} required>
              <option value="">Selecione...</option>
              {categorias.map(c => <option key={c} value={c}>{categoriaLabel[c]}</option>)}
            </select>
          </div>
        )}
      </Modal>
    </div>
  )
}
