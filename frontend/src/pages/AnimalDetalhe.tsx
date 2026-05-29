import { useEffect, useState, FormEvent, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api, { Animal, Pesagem, Saude, Reproducao, Movimentacao, Lote } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { formatKg, formatBRL } from '../utils/format'
import { apiErrorMessage } from '../utils/apiError'

interface Historico {
  animal: Animal
  pesagens: Pesagem[]
  saudes: Saude[]
  reproducoes: Reproducao[]
  movimentacoes: Movimentacao[]
}

const statusBadge: Record<string, string> = {
  ativo: 'badge-green', vendido: 'badge-blue', morto: 'badge-gray', transferido: 'badge-amber'
}
const statusLabel: Record<string, string> = {
  ativo: 'Ativo', vendido: 'Vendido', morto: 'Morto', transferido: 'Transferido'
}
const tipoSaudeBadge: Record<string, string> = {
  vacinacao: 'badge-pink', vermifugacao: 'badge-teal', tratamento: 'badge-amber',
  exame: 'badge-blue', cirurgia: 'badge-red'
}
const tipoSaudeLabel: Record<string, string> = {
  vacinacao: 'Vacinação', vermifugacao: 'Vermifugação', tratamento: 'Tratamento',
  exame: 'Exame', cirurgia: 'Cirurgia'
}
const resultadoReprodBadge: Record<string, string> = {
  prenha: 'badge-green', vazia: 'badge-gray', 'nasceu bezerro': 'badge-pink', aborto: 'badge-red'
}

export default function AnimalDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [hist, setHist] = useState<Historico | null>(null)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [tab, setTab] = useState<'pesagens' | 'saude' | 'reproducao' | 'movimentacoes'>('pesagens')
  const { success, error: toastError } = useToast()
  const [editStatus, setEditStatus] = useState(false)
  const [novoStatus, setNovoStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    brinco: '', nome: '', raca: '', sexo: 'macho', categoria: '',
    data_nascimento: '', peso_entrada: '', lote_id: '', observacoes: ''
  })

  function load() {
    api.get(`/animais/${id}/historico`).then(r => {
      setHist(r.data)
      setNovoStatus(r.data.animal.status)
    })
  }

  useEffect(() => { load(); api.get('/lotes').then(r => setLotes(r.data)) }, [id])

  async function salvarStatus() {
    setSaving(true)
    await api.put(`/animais/${id}`, { status: novoStatus })
    setSaving(false)
    setEditStatus(false)
    load()
  }

  function openEdit() {
    if (!hist) return
    const a = hist.animal
    setEditForm({
      brinco: a.brinco || '', nome: a.nome || '', raca: a.raca || '', sexo: a.sexo,
      categoria: a.categoria || '',
      data_nascimento: a.data_nascimento || '', peso_entrada: a.peso_entrada?.toString() || '',
      lote_id: a.lote_id?.toString() || '', observacoes: a.observacoes || ''
    })
    setShowEdit(true)
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/animais/${id}`, {
        brinco: editForm.brinco || undefined,
        nome: editForm.nome || undefined,
        raca: editForm.raca || undefined,
        sexo: editForm.sexo,
        categoria: editForm.categoria || null,
        data_nascimento: editForm.data_nascimento || undefined,
        peso_entrada: editForm.peso_entrada ? parseFloat(editForm.peso_entrada) : undefined,
        lote_id: editForm.lote_id ? parseInt(editForm.lote_id) : null,
        observacoes: editForm.observacoes || undefined,
      })
      setShowEdit(false)
      load()
      success('Animal atualizado com sucesso!')
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao atualizar'))
    } finally {
      setSaving(false)
    }
  }

  const fotoRef = useRef<HTMLInputElement>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploadingFoto(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      await api.post(`/animais/${id}/foto`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      load()
      success('Foto atualizada')
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao enviar foto'))
    } finally {
      setUploadingFoto(false)
      e.target.value = ''
    }
  }

  async function removerFoto() {
    if (!confirm('Remover foto?')) return
    try {
      await api.delete(`/animais/${id}/foto`)
      load()
      success('Foto removida')
    } catch {
      toastError('Erro ao remover foto')
    }
  }

  async function deletar() {
    if (!confirm('Excluir este animal permanentemente? Esta ação não pode ser desfeita.')) return
    await api.delete(`/animais/${id}`)
    navigate('/animais')
  }

  async function deletarPesagem(pesagemId: number) {
    if (!confirm('Excluir esta pesagem?')) return
    try {
      await api.delete(`/pesagens/${pesagemId}`)
      load()
      success('Pesagem excluída')
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao excluir pesagem'))
    }
  }

  if (!hist) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--gray-500)', padding: 40 }}>
      <span className="spinner spinner-dark" /> Carregando...
    </div>
  )

  const { animal } = hist
  const loteNome = lotes.find(l => l.id === animal.lote_id)?.nome

  const tabs = [
    { key: 'pesagens', label: 'Pesagens', count: hist.pesagens.length },
    { key: 'saude', label: 'Saúde', count: hist.saudes.length },
    { key: 'reproducao', label: 'Reprodução', count: hist.reproducoes.length },
    { key: 'movimentacoes', label: 'Movimentações', count: hist.movimentacoes.length },
  ] as const

  const ultimaPesagem = hist.pesagens[0]

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/animais')}
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 20 }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
        Voltar para Animais
      </button>

      {/* Cabeçalho do animal */}
      <div className="card card-padded" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {animal.foto_url ? (
                <img
                  src={`/api${animal.foto_url}`}
                  alt={animal.nome || animal.brinco || 'Animal'}
                  style={{ width: 80, height: 80, borderRadius: 14, objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                  onClick={() => fotoRef.current?.click()}
                />
              ) : (
                <div
                  onClick={() => fotoRef.current?.click()}
                  title="Adicionar foto"
                  style={{
                    width: 80, height: 80, borderRadius: 14,
                    background: animal.sexo === 'macho' ? 'var(--blue-100)' : 'var(--pink-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, cursor: 'pointer'
                  }}
                >
                  {animal.sexo === 'macho' ? '♂' : '♀'}
                </div>
              )}
              {uploadingFoto && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="spinner" />
                </div>
              )}
              {animal.foto_url && !uploadingFoto && (
                <button
                  type="button"
                  onClick={removerFoto}
                  title="Remover foto"
                  style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'var(--red-600)', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                >
                  ×
                </button>
              )}
              <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFoto} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)' }}>
                Brinco #{animal.brinco}
                {animal.nome && <span style={{ color: 'var(--gray-500)', fontWeight: 500, fontSize: 16 }}> — {animal.nome}</span>}
              </div>
              <div style={{ color: 'var(--gray-500)', marginTop: 4, fontSize: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{animal.raca || 'Raça não informada'}</span>
                {animal.categoria && (
                  <span style={{ fontWeight: 600, color: 'var(--gray-700)', textTransform: 'capitalize' }}>
                    · {animal.categoria.replace('_', ' ')}
                  </span>
                )}
                {loteNome && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ·
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4M3 7v10l9 4m0-14v14m9-10v10l-9 4"/>
                    </svg>
                    {loteNome}
                  </span>
                )}
                {animal.data_nascimento && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ·
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    {new Date(animal.data_nascimento + 'T00:00').toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {editStatus ? (
              <>
                <select
                  value={novoStatus}
                  onChange={e => setNovoStatus(e.target.value)}
                  className="form-select"
                  style={{ width: 'auto' }}
                >
                  <option value="ativo">Ativo</option>
                  <option value="vendido">Vendido</option>
                  <option value="morto">Morto</option>
                  <option value="transferido">Transferido</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={salvarStatus} disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Salvar'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditStatus(false)}>Cancelar</button>
              </>
            ) : (
              <>
                <span className={`badge ${statusBadge[animal.status]}`} style={{ fontSize: 13, padding: '5px 14px' }}>
                  {statusLabel[animal.status]}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditStatus(true)}>Mudar status</button>
                <button className="btn btn-primary btn-sm" onClick={openEdit}>Editar</button>
                <button className="btn btn-danger btn-sm" onClick={deletar}>Excluir</button>
              </>
            )}
          </div>
        </div>

        {/* Stats rápidas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--gray-100)' }}>
          {[
            { label: 'Peso de Entrada', value: animal.peso_entrada != null ? formatKg(animal.peso_entrada) : '—' },
            { label: 'Último Peso', value: ultimaPesagem ? formatKg(ultimaPesagem.peso_kg, 1) : '—' },
            { label: 'Origem', value: animal.origem === 'nascido' ? 'Nascido na fazenda' : animal.origem === 'comprado' ? 'Comprado' : animal.origem || '—' },
            { label: 'Cadastrado em', value: new Date(animal.created_at).toLocaleDateString('pt-BR') },
          ].map(i => (
            <div key={i.label}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{i.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)' }}>{i.value}</div>
            </div>
          ))}
        </div>

        {animal.observacoes && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--gray-600)', borderLeft: '3px solid var(--gray-300)' }}>
            {animal.observacoes}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--gray-200)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--green-700)' : '2px solid transparent',
              marginBottom: -2,
              background: 'none',
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--green-800)' : 'var(--gray-500)',
              fontFamily: 'Inter, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s',
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: tab === t.key ? 'var(--green-100)' : 'var(--gray-100)',
                color: tab === t.key ? 'var(--green-700)' : 'var(--gray-500)',
                padding: '1px 7px', borderRadius: 'var(--radius-full)'
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pesagens */}
      {tab === 'pesagens' && (
        <div className="card card-padded">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>Histórico de Pesagens</h3>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/pesagens?animal_id=${id}`)}>
              + Registrar Pesagem
            </button>
          </div>
          {hist.pesagens.length === 0
            ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-500)', fontSize: 13 }}>Sem pesagens registradas</div>
            : (
              <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th><th>Peso</th><th>GMD (kg/dia)</th><th>Observações</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {hist.pesagens.map(p => (
                    <tr key={p.id}>
                      <td>{new Date(p.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontWeight: 700, color: 'var(--green-700)' }}>{formatKg(p.peso_kg, 1)}</td>
                      <td style={{ fontWeight: 700, color: p.gmd && p.gmd > 0 ? 'var(--green-700)' : 'var(--red-600)' }}>
                        {p.gmd != null ? `${p.gmd > 0 ? '+' : ''}${p.gmd}` : '—'}
                      </td>
                      <td style={{ color: 'var(--gray-400)', fontSize: 13 }}>{p.observacoes || '—'}</td>
                      <td>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => deletarPesagem(p.id)} title="Excluir">
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )
          }
        </div>
      )}

      {/* Saúde */}
      {tab === 'saude' && (
        <div className="card card-padded">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>Histórico de Saúde</h3>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/saude?animal_id=${id}`)}>
              + Registrar
            </button>
          </div>
          {hist.saudes.length === 0
            ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-500)', fontSize: 13 }}>Sem registros de saúde</div>
            : (
              <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Medicamento</th><th>Custo</th><th>Próxima</th></tr>
                </thead>
                <tbody>
                  {hist.saudes.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                      <td><span className={`badge ${tipoSaudeBadge[s.tipo] || 'badge-gray'}`}>{tipoSaudeLabel[s.tipo] || s.tipo}</span></td>
                      <td>{s.descricao}</td>
                      <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{s.medicamento || '—'}</td>
                      <td style={{ fontWeight: 600, color: s.custo ? 'var(--red-600)' : 'var(--gray-400)' }}>{s.custo != null ? formatBRL(s.custo) : '—'}</td>
                      <td style={{ color: s.proxima_data ? 'var(--amber-600)' : 'var(--gray-400)', fontWeight: 600, fontSize: 13 }}>
                        {s.proxima_data ? new Date(s.proxima_data + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )
          }
        </div>
      )}

      {/* Reprodução */}
      {tab === 'reproducao' && (
        <div className="card card-padded">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>Reprodução</h3>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/reproducao?animal_id=${id}`)}>
              + Registrar
            </button>
          </div>
          {hist.reproducoes.length === 0
            ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-500)', fontSize: 13 }}>Sem registros reprodutivos</div>
            : (
              <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Resultado</th><th>Touro</th><th>Parto Previsto</th></tr>
                </thead>
                <tbody>
                  {hist.reproducoes.map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontSize: 13 }}>{r.tipo.replace(/_/g, ' ')}</td>
                      <td>
                        {r.resultado
                          ? <span className={`badge ${resultadoReprodBadge[r.resultado] || 'badge-gray'}`}>{r.resultado}</span>
                          : <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Pendente</span>
                        }
                      </td>
                      <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{r.touro_brinco || '—'}</td>
                      <td style={{ color: 'var(--green-700)', fontWeight: 600, fontSize: 13 }}>
                        {r.data_prevista_parto ? new Date(r.data_prevista_parto + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )
          }
        </div>
      )}

      {/* Movimentações */}
      {tab === 'movimentacoes' && (
        <div className="card card-padded">
          <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Movimentações</h3>
          {hist.movimentacoes.length === 0
            ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-500)', fontSize: 13 }}>Sem movimentações</div>
            : (
              <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Peso</th><th>Observações</th></tr>
                </thead>
                <tbody>
                  {hist.movimentacoes.map(m => (
                    <tr key={m.id}>
                      <td>{new Date(m.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                      <td>{m.tipo}</td>
                      <td style={{ fontWeight: 600 }}>{m.valor != null ? formatBRL(m.valor) : '—'}</td>
                      <td style={{ fontSize: 13 }}>{m.peso_kg ? formatKg(m.peso_kg) : '—'}</td>
                      <td style={{ color: 'var(--gray-400)', fontSize: 13 }}>{m.observacoes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )
          }
        </div>
      )}

      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Editar Animal"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancelar</button>
            <button className="btn btn-primary" form="form-edit-animal" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Salvando...</> : 'Salvar'}
            </button>
          </>
        }
      >
        <form id="form-edit-animal" onSubmit={handleEditSubmit}>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Brinco</label>
              <input className="form-input" value={editForm.brinco} onChange={e => setEditForm(p => ({ ...p, brinco: e.target.value }))} placeholder="Ex: 001" />
            </div>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" value={editForm.nome} onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Mimosa" />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Raça</label>
              <input className="form-input" value={editForm.raca} onChange={e => setEditForm(p => ({ ...p, raca: e.target.value }))} placeholder="Ex: Nelore" />
            </div>
            <div className="form-group">
              <label className="form-label">Sexo</label>
              <select className="form-select" value={editForm.sexo} onChange={e => setEditForm(p => ({ ...p, sexo: e.target.value }))}>
                <option value="macho">Macho</option>
                <option value="femea">Fêmea</option>
              </select>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Data de Nascimento</label>
              <input className="form-input" type="date" value={editForm.data_nascimento} onChange={e => setEditForm(p => ({ ...p, data_nascimento: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Peso de Entrada (kg)</label>
              <input className="form-input" type="number" step="0.1" value={editForm.peso_entrada} onChange={e => setEditForm(p => ({ ...p, peso_entrada: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Lote</label>
              <select className="form-select" value={editForm.lote_id} onChange={e => setEditForm(p => ({ ...p, lote_id: e.target.value }))}>
                <option value="">Sem lote</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-select" value={editForm.categoria} onChange={e => setEditForm(p => ({ ...p, categoria: e.target.value }))}>
                <option value="">— Nenhuma —</option>
                <option value="bezerro">Bezerro</option>
                <option value="garrote">Garrote</option>
                <option value="novilha">Novilha</option>
                <option value="vaca">Vaca</option>
                <option value="boi_magro">Boi Magro</option>
                <option value="boi_gordo">Boi Gordo</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <input className="form-input" value={editForm.observacoes} onChange={e => setEditForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Opcional..." />
          </div>
        </form>
      </Modal>
    </div>
  )
}
