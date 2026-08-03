import { useEffect, useState, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { Reproducao as ReproducaoType, Animal } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { todayLocal } from '../utils/date'
import { apiErrorMessage } from '../utils/apiError'

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
  animal_id: '', brinco_vaca: '', tipo: 'inseminacao',
  data: todayLocal(),
  touro_brinco: '', resultado: '', data_prevista_parto: '',
  bezerro_brinco: '', bezerro_sexo: 'femea', bezerro_peso_kg: '',
  observacoes: ''
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.get('/animais', { params: { status: 'ativo', sexo: 'femea', page_size: 200 } }).then(r => setAnimais(r.data.items))
  }, [])
  function load() {
    const p: any = {}
    if (filtroAnimal) p.animal_id = filtroAnimal
    api.get('/reproducao', { params: p }).then(r => setRegistros(r.data))
  }
  useEffect(load, [filtroAnimal])

  // Quando seleciona uma fêmea, pre-preenche o brinco com o atual
  function selecionarFemea(id: string) {
    const a = animais.find(x => String(x.id) === id)
    setForm(f => ({ ...f, animal_id: id, brinco_vaca: a?.brinco || '' }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    try {
      const animalAtual = animais.find(a => String(a.id) === form.animal_id)
      const brincoAtual = animalAtual?.brinco || ''
      const brincoNovo = form.brinco_vaca.trim()
      // Se mudou ou adicionou brinco, atualiza o animal primeiro
      if (brincoNovo !== brincoAtual && form.animal_id) {
        await api.put(`/animais/${form.animal_id}`, { brinco: brincoNovo || null })
      }
      await api.post('/reproducao', {
        animal_id: parseInt(form.animal_id), tipo: form.tipo, data: form.data,
        touro_brinco: form.touro_brinco || undefined,
        resultado: form.resultado || undefined,
        data_prevista_parto: form.data_prevista_parto || undefined,
        bezerro_brinco: form.bezerro_brinco || undefined,
        bezerro_sexo: form.bezerro_sexo || undefined,
        bezerro_peso_kg: form.bezerro_peso_kg ? parseFloat(form.bezerro_peso_kg) : undefined,
        observacoes: form.observacoes || undefined
      })
      setShowModal(false)
      setForm(emptyForm)
      // Recarrega lista de animais para refletir brinco atualizado
      const r = await api.get('/animais', { params: { status: 'ativo', sexo: 'femea', page_size: 200 } })
      setAnimais(r.data.items)
      load()
      success('Registro reprodutivo salvo!')
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao registrar'))
      toastError('Erro ao salvar registro reprodutivo')
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

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAllVisible() {
    const visibleIds = registros.map(r => r.id)
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
      const r = await api.post('/reproducao/bulk-delete', { ids })
      success(`${r.data.afetados} registro(s) excluído(s)`)
      clearSelection()
      load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao excluir em massa'))
    } finally {
      setSaving(false)
    }
  }

  const animaisMap = Object.fromEntries(animais.map(a => [a.id, a]))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reprodução</div>
          <div className="page-subtitle">Controle de cobertura, inseminação e partos</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setErro(''); setForm(emptyForm); setShowModal(true) }}>
          + Registrar
        </button>
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
        <label className="filter-label">Animal (fêmea):</label>
        <select className="form-select" style={{ width: 260 }} value={filtroAnimal} onChange={e => setFiltroAnimal(e.target.value)}>
          <option value="">Todos</option>
          {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco}{a.nome ? ` — ${a.nome}` : ''}</option>)}
        </select>
      </div>

      {registros.length > 0 && (
        <label className="mobile-select-all">
          <input
            type="checkbox"
            aria-label="Selecionar todos os registros visíveis"
            checked={registros.length > 0 && registros.every(r => selectedIds.has(r.id))}
            ref={el => { if (el) { const some = registros.some(r => selectedIds.has(r.id)); const all = registros.length > 0 && registros.every(r => selectedIds.has(r.id)); el.indeterminate = some && !all } }}
            onChange={toggleAllVisible}
          />
          <span>Selecionar todos{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}</span>
        </label>
      )}

      <div className="table-wrapper table-wrapper-cards">
        <table className="data-table table-cards">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={registros.length > 0 && registros.every(r => selectedIds.has(r.id))}
                  onChange={toggleAllVisible}
                />
              </th>
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
              <tr><td colSpan={9} className="table-empty">Nenhum registro encontrado</td></tr>
            )}
            {registros.map(r => {
              const a = animaisMap[r.animal_id]
              return (
                <tr key={r.id} style={{ background: selectedIds.has(r.id) ? 'var(--green-50)' : undefined }}>
                  <td className="cell-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                  </td>
                  <td data-label="Animal" style={{ fontWeight: 600 }}>#{a ? a.brinco : r.animal_id}</td>
                  <td data-label="Data">{new Date(r.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                  <td data-label="Tipo"><span className="badge badge-teal">{tipoLabel[r.tipo] || r.tipo}</span></td>
                  <td data-label="Resultado">
                    {r.resultado
                      ? <span className={`badge ${resultadoBadge[r.resultado] || 'badge-gray'}`}>{resultadoLabel[r.resultado] || r.resultado}</span>
                      : <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Pendente</span>
                    }
                  </td>
                  <td data-label="Touro" style={{ color: 'var(--gray-500)', fontSize: 13 }}>{r.touro_brinco ? `#${r.touro_brinco}` : '—'}</td>
                  <td data-label="Parto previsto" style={{ fontWeight: 600, color: 'var(--green-700)', fontSize: 13 }}>
                    {r.data_prevista_parto ? new Date(r.data_prevista_parto + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td data-label="Bezerro" style={{ color: 'var(--gray-500)', fontSize: 13 }}>{r.bezerro_brinco ? `#${r.bezerro_brinco}` : '—'}</td>
                  <td className="cell-actions">
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
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Fêmea *</label>
              <select className="form-select" value={form.animal_id} onChange={e => selecionarFemea(e.target.value)} required autoFocus>
                <option value="">Selecione...</option>
                {animais.map(a => <option key={a.id} value={a.id}>#{a.brinco || '(sem brinco)'}{a.nome ? ` — ${a.nome}` : ''}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Brinco da Vaca</label>
              <input
                className="form-input"
                value={form.brinco_vaca}
                onChange={e => setForm(f => ({ ...f, brinco_vaca: e.target.value }))}
                placeholder="Adicionar ou alterar brinco"
                disabled={!form.animal_id}
              />
              {form.animal_id && (() => {
                const a = animais.find(x => String(x.id) === form.animal_id)
                const atual = a?.brinco || ''
                if (form.brinco_vaca.trim() === atual) return null
                return (
                  <div style={{ fontSize: 11, color: 'var(--amber-700, #b45309)', marginTop: 4 }}>
                    Será atualizado de "{atual || '(vazio)'}" para "{form.brinco_vaca.trim() || '(vazio)'}"
                  </div>
                )
              })()}
            </div>
          </div>
          <div className="grid-3" style={{ marginBottom: 0 }}>
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
            <div className="form-group">
              <label className="form-label">Brinco do Touro</label>
              <input className="form-input" value={form.touro_brinco} onChange={e => setForm(f => ({ ...f, touro_brinco: e.target.value }))} placeholder="Ex: T-001" />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
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

          {/* Bezerro nascido — só aparece quando faz sentido */}
          {(form.resultado === 'nasceu bezerro' || (form.tipo === 'parto' && form.resultado !== 'aborto')) && (
            <div style={{ borderTop: '1px solid var(--gray-200)', marginTop: 12, paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--green-800)' }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Bezerro nascido — será criado automaticamente em Animais
              </div>
              <div className="grid-3" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="form-label">Brinco do Bezerro</label>
                  <input className="form-input" value={form.bezerro_brinco} onChange={e => setForm(f => ({ ...f, bezerro_brinco: e.target.value }))} placeholder="Opcional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sexo</label>
                  <select className="form-select" value={form.bezerro_sexo} onChange={e => setForm(f => ({ ...f, bezerro_sexo: e.target.value }))}>
                    <option value="femea">♀ Fêmea</option>
                    <option value="macho">♂ Macho</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Peso ao Nascer (kg)</label>
                  <input className="form-input" type="number" inputMode="decimal" step="0.1" value={form.bezerro_peso_kg} onChange={e => setForm(f => ({ ...f, bezerro_peso_kg: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Observações</label>
            <input className="form-input" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional..." />
          </div>
        </form>
      </Modal>
    </div>
  )
}
