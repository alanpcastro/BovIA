import { useEffect, useState, FormEvent } from 'react'
import api, { Lote } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

const emptyForm = { nome: '', area_ha: '', descricao: '' }

export default function Lotes() {
  const { success, error: toastError } = useToast()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Lote | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [erro, setErro] = useState('')
  const [saving, setSaving] = useState(false)

  function load() { api.get('/lotes').then(r => setLotes(r.data)) }
  useEffect(load, [])

  function openNew() { setForm(emptyForm); setEditing(null); setErro(''); setShowModal(true) }

  function openEdit(l: Lote) {
    setEditing(l)
    setForm({ nome: l.nome, area_ha: l.area_ha?.toString() || '', descricao: l.descricao || '' })
    setErro('')
    setShowModal(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    const payload = {
      nome: form.nome,
      area_ha: form.area_ha ? parseFloat(form.area_ha) : undefined,
      descricao: form.descricao || undefined
    }
    try {
      if (editing) {
        await api.put(`/lotes/${editing.id}`, payload)
        success('Lote atualizado com sucesso!')
      } else {
        await api.post('/lotes', payload)
        success('Lote criado com sucesso!')
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao salvar')
      toastError('Erro ao salvar lote')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este lote? Os animais não serão removidos.')) return
    try {
      await api.delete(`/lotes/${id}`)
      load()
      success('Lote excluído')
    } catch {
      toastError('Erro ao excluir lote')
    }
  }

  const colors = ['var(--green-800)', 'var(--teal-600)', 'var(--blue-600)', 'var(--amber-600)', 'var(--pink-600)']

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Lotes / Pastos</div>
          <div className="page-subtitle">{lotes.length} lote(s) cadastrado(s)</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Novo Lote
        </button>
      </div>

      {lotes.length === 0 && (
        <div className="card card-padded" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
          <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 6 }}>Nenhum lote cadastrado</div>
          <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 20 }}>Crie lotes para organizar seu rebanho por pasto ou área</div>
          <button className="btn btn-primary" onClick={openNew}>Criar primeiro lote</button>
        </div>
      )}

      <div className="grid-auto">
        {lotes.map((l, i) => (
          <div key={l.id} className="card card-padded" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Color stripe at top */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: colors[i % colors.length]
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 8,
                    background: colors[i % colors.length] + '15',
                    color: colors[i % colors.length], flexShrink: 0
                  }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4M3 7v10l9 4m0-14v14m9-10v10l-9 4"/>
                    </svg>
                  </span>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>{l.nome}</div>
                </div>
                {l.area_ha && (
                  <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>
                    📐 {l.area_ha} hectares
                  </div>
                )}
                {l.descricao && (
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4, lineHeight: 1.4 }}>{l.descricao}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                <button
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={() => openEdit(l)}
                  title="Editar"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                </button>
                <button
                  className="btn btn-danger btn-sm btn-icon"
                  onClick={() => handleDelete(l.id)}
                  title="Excluir"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Editar Lote' : 'Novo Lote'}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-lote" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : 'Salvar'}
            </button>
          </>
        }
      >
        {erro && <div className="alert alert-error">{erro}</div>}
        <form id="form-lote" onSubmit={handleSubmit}>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required autoFocus placeholder="Ex: Pasto Norte" />
            </div>
            <div className="form-group">
              <label className="form-label">Área (ha)</label>
              <input className="form-input" type="number" step="0.1" value={form.area_ha} onChange={e => setForm(p => ({ ...p, area_ha: e.target.value }))} placeholder="Ex: 120" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Opcional..." />
          </div>
        </form>
      </Modal>
    </div>
  )
}
