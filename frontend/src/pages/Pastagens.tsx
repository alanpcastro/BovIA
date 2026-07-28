import { useEffect, useState, FormEvent } from 'react'
import api, { Pasto, Lote, HistoricoOcupacao, AlertaPasto } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { formatPct } from '../utils/format'
import { apiErrorMessage } from '../utils/apiError'
import { todayLocal } from '../utils/date'

const emptyForm = { nome: '', area_ha: '', capacidade_ua_ha: '1.5', descricao: '' }
const hoje = todayLocal

export default function Pastagens() {
  const { success, error: toastError } = useToast()
  const [pastos, setPastos] = useState<Pasto[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [alertas, setAlertas] = useState<AlertaPasto[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Pasto | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [ocupandoPasto, setOcupandoPasto] = useState<Pasto | null>(null)
  const [ocupForm, setOcupForm] = useState({ lote_id: '', data_entrada: hoje(), observacoes: '', forcar: false })
  const [avisoDescanso, setAvisoDescanso] = useState<string | null>(null)

  const [historicoPasto, setHistoricoPasto] = useState<Pasto | null>(null)
  const [historicos, setHistoricos] = useState<HistoricoOcupacao[]>([])

  async function load() {
    const [rPastos, rLotes, rAlertas] = await Promise.all([
      api.get<Pasto[]>('/pastos'),
      api.get<Lote[]>('/lotes'),
      api.get<AlertaPasto[]>('/pastos/alertas'),
    ])
    setPastos(rPastos.data)
    setLotes(rLotes.data)
    setAlertas(rAlertas.data)
  }
  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(p: Pasto) {
    setEditing(p)
    setForm({
      nome: p.nome,
      area_ha: String(p.area_ha),
      capacidade_ua_ha: p.capacidade_ua_ha != null ? String(p.capacidade_ua_ha) : '',
      descricao: p.descricao || '',
    })
    setShowForm(true)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        nome: form.nome,
        area_ha: parseFloat(form.area_ha),
        capacidade_ua_ha: form.capacidade_ua_ha ? parseFloat(form.capacidade_ua_ha) : undefined,
        descricao: form.descricao || undefined,
      }
      if (editing) {
        await api.put(`/pastos/${editing.id}`, payload)
        success('Pasto atualizado')
      } else {
        await api.post('/pastos', payload)
        success('Pasto criado')
      }
      setShowForm(false)
      await load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao salvar pasto'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Pasto) {
    if (!confirm(`Excluir pasto "${p.nome}"?`)) return
    try {
      await api.delete(`/pastos/${p.id}`)
      success('Pasto excluído')
      load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao excluir'))
    }
  }

  function abrirOcupar(p: Pasto) {
    setOcupandoPasto(p)
    setOcupForm({ lote_id: '', data_entrada: hoje(), observacoes: '', forcar: false })
    setAvisoDescanso(null)
  }

  async function handleOcupar(e: FormEvent) {
    e.preventDefault()
    if (!ocupandoPasto) return
    try {
      await api.post(`/pastos/${ocupandoPasto.id}/ocupar`, {
        lote_id: parseInt(ocupForm.lote_id),
        data_entrada: ocupForm.data_entrada,
        observacoes: ocupForm.observacoes || undefined,
        forcar: ocupForm.forcar,
      })
      success('Lote colocado no pasto')
      setOcupandoPasto(null)
      load()
    } catch (err: any) {
      const msg = apiErrorMessage(err, 'Erro ao ocupar pasto')
      // Backend responde 400 com mensagem sobre descanso mínimo — oferece opção de forçar
      if (err?.response?.status === 400 && /descanso/i.test(msg)) {
        setAvisoDescanso(msg)
      } else {
        toastError(msg)
      }
    }
  }

  async function handleDesocupar(p: Pasto, loteId: number) {
    if (!confirm('Desocupar lote deste pasto?')) return
    try {
      await api.post(`/pastos/${p.id}/desocupar`, {
        lote_id: loteId,
        data_saida: hoje(),
      })
      success('Lote desocupado — pasto em descanso')
      load()
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao desocupar'))
    }
  }

  async function abrirHistorico(p: Pasto) {
    setHistoricoPasto(p)
    try {
      const res = await api.get<HistoricoOcupacao[]>(`/pastos/${p.id}/historico`)
      setHistoricos(res.data)
    } catch {
      setHistoricos([])
    }
  }

  const lotesDisponiveis = lotes.filter(l => !l.pasto_atual_id)

  const statusLabel = (s: Pasto['status']) =>
    s === 'ocupado' ? 'Ocupado' : s === 'descanso' ? 'Em descanso' : 'Disponível'

  const statusColor = (s: Pasto['status']) =>
    s === 'ocupado' ? 'var(--green-700)' : s === 'descanso' ? 'var(--amber-600)' : 'var(--gray-500)'

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Controle de Pastagens</div>
          <div className="page-subtitle">{pastos.length} pasto(s) • {alertas.length} alerta(s)</div>
        </div>
        <button className="btn btn-xl btn-primary" onClick={openNew}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Pasto
        </button>
      </div>

      {alertas.length > 0 && (
        <div className="card card-padded" style={{ marginBottom: 16, borderLeft: '4px solid var(--red-600)' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--red-700)', marginBottom: 8 }}>
            ⚠️ Alertas de Pastagem
          </div>
          {alertas.map((a, i) => (
            <div key={i} style={{
              padding: '8px 0',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              fontSize: 14,
              color: 'var(--gray-800)',
            }}>
              <strong style={{
                color: a.severidade === 'alta' ? 'var(--red-600)' : a.severidade === 'media' ? 'var(--amber-600)' : 'var(--gray-600)',
              }}>
                [{a.severidade.toUpperCase()}]
              </strong>{' '}
              {a.mensagem}
            </div>
          ))}
        </div>
      )}

      {pastos.length === 0 && (
        <div className="card card-padded" style={{ textAlign: 'center', padding: 48 }}>
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="var(--green-700)" strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v8m0 0c-4 0-7 3-7 7v5h14v-5c0-4-3-7-7-7zM8 10c-2 0-4 1-5 3M16 10c2 0 4 1 5 3"/>
          </svg>
          <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 6 }}>Nenhum pasto cadastrado</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
            Cadastre seus pastos para controlar lotação, rotação e descanso
          </div>
          <button className="btn btn-primary" onClick={openNew}>Criar primeiro pasto</button>
        </div>
      )}

      <div className="grid-auto">
        {pastos.map(p => (
          <div key={p.id} className="card card-padded" style={{
            borderLeft: p.superlotado ? '4px solid var(--red-600)' : `4px solid ${statusColor(p.status)}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--gray-900)' }}>{p.nome}</div>
                <div style={{ fontSize: 13, color: statusColor(p.status), fontWeight: 700, marginTop: 2 }}>
                  {statusLabel(p.status)}
                  {p.dias_ocupacao != null && ` • ${p.dias_ocupacao} dias ocupado`}
                  {p.dias_descanso != null && ` • ${p.dias_descanso} dias de descanso`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(p)} title="Editar">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(p)} title="Excluir">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Área</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{p.area_ha} ha</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Animais</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{p.total_animais}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Taxa atual</div>
                <div style={{
                  fontSize: 18, fontWeight: 800,
                  color: p.superlotado ? 'var(--red-600)' : 'var(--gray-900)',
                }}>
                  {p.taxa_lotacao_ua_ha} UA/ha
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Capacidade</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {p.capacidade_ua_ha ?? '—'} UA/ha
                </div>
              </div>
            </div>

            {p.capacidade_ua_ha && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-600)', marginBottom: 4 }}>
                  <span>Ocupação</span>
                  <span style={{ fontWeight: 700 }}>{formatPct(p.ocupacao_pct, 0)}</span>
                </div>
                <div style={{ height: 8, background: 'var(--gray-200)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(p.ocupacao_pct, 100)}%`,
                    height: '100%',
                    background: p.superlotado ? 'var(--red-500)' : p.ocupacao_pct > 80 ? 'var(--amber-500)' : 'var(--green-600)',
                    transition: 'width .3s',
                  }} />
                </div>
              </div>
            )}

            {p.lotes_no_pasto.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Lotes no pasto
                </div>
                {p.lotes_no_pasto.map(l => (
                  <div key={l.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', background: 'var(--surface-subtle)', borderRadius: 6, marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {l.nome} <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>({l.total_animais} animais)</span>
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDesocupar(p, l.id)}
                      title="Desocupar"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                    >
                      Desocupar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => abrirOcupar(p)}
                disabled={lotesDisponiveis.length === 0}
                style={{ flex: 1 }}
              >
                Colocar lote
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => abrirHistorico(p)}>
                Histórico
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal criar/editar */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar Pasto' : 'Novo Pasto'}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-pasto" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <form id="form-pasto" onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" required value={form.nome}
              onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Pasto Norte" autoFocus />
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Área (ha) *</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.1" required
                value={form.area_ha}
                onChange={e => setForm(p => ({ ...p, area_ha: e.target.value }))}
                placeholder="Ex: 50" />
            </div>
            <div className="form-group">
              <label className="form-label">Capacidade (UA/ha)</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.1"
                value={form.capacidade_ua_ha}
                onChange={e => setForm(p => ({ ...p, capacidade_ua_ha: e.target.value }))}
                placeholder="Ex: 1.5" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" value={form.descricao}
              onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Opcional" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            1 UA = 450 kg de peso vivo. Capacidade típica: 1.0–2.0 UA/ha.
          </div>
        </form>
      </Modal>

      {/* Modal ocupar */}
      <Modal
        open={!!ocupandoPasto}
        onClose={() => setOcupandoPasto(null)}
        title={`Colocar lote em ${ocupandoPasto?.nome ?? ''}`}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setOcupandoPasto(null)}>Cancelar</button>
            <button className="btn btn-primary" form="form-ocupar" type="submit">Confirmar</button>
          </>
        }
      >
        <form id="form-ocupar" onSubmit={handleOcupar}>
          <div className="form-group">
            <label className="form-label">Lote *</label>
            <select className="form-input" required value={ocupForm.lote_id}
              onChange={e => setOcupForm(p => ({ ...p, lote_id: e.target.value }))}>
              <option value="">Selecione...</option>
              {lotesDisponiveis.map(l => (
                <option key={l.id} value={l.id}>{l.nome} ({l.total_animais ?? 0} animais)</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Data de entrada *</label>
            <input className="form-input" type="date" required value={ocupForm.data_entrada}
              onChange={e => setOcupForm(p => ({ ...p, data_entrada: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <input className="form-input" value={ocupForm.observacoes}
              onChange={e => setOcupForm(p => ({ ...p, observacoes: e.target.value }))} />
          </div>
          {avisoDescanso && (
            <div style={{ padding: 12, background: 'var(--amber-100)', borderRadius: 6, marginTop: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--amber-800)', marginBottom: 8 }}>
                ⚠️ {avisoDescanso}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ocupForm.forcar}
                  onChange={e => setOcupForm(p => ({ ...p, forcar: e.target.checked }))}
                />
                Forçar ocupação mesmo assim
              </label>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal histórico */}
      <Modal
        open={!!historicoPasto}
        onClose={() => setHistoricoPasto(null)}
        title={`Histórico — ${historicoPasto?.nome ?? ''}`}
        size="md"
      >
        {historicos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>
            Nenhuma ocupação registrada
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Dias</th>
                </tr>
              </thead>
              <tbody>
                {historicos.map(h => (
                  <tr key={h.id}>
                    <td>{h.lote_nome || `Lote ${h.lote_id}`}</td>
                    <td>{h.data_entrada}</td>
                    <td>{h.data_saida || <em style={{ color: 'var(--green-700)' }}>ocupado</em>}</td>
                    <td>{h.dias ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
