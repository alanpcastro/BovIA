import { useEffect, useState, FormEvent, useMemo } from 'react'
import api, { Lote } from '../services/api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { formatBRL, formatNumber } from '../utils/format'
import { todayLocal } from '../utils/date'
import { apiErrorMessage } from '../utils/apiError'

const emptyForm = { nome: '', descricao: '', ua_ha: '1.0', data_entrada: todayLocal() }

const emptySaleForm = {
  peso_medio: '',
  preco_arroba: '',
  qtd: '',
  rendimento: '52',
  frete_por_animal: '',
  imposto_pct: '',
}

export default function Lotes() {
  const { success, error: toastError } = useToast()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Lote | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [erro, setErro] = useState('')
  const [saving, setSaving] = useState(false)

  // Modal de simulação de venda
  const [saleLote, setSaleLote] = useState<Lote | null>(null)
  const [saleForm, setSaleForm] = useState(emptySaleForm)

  function load() { api.get('/lotes').then(r => setLotes(r.data)) }
  useEffect(load, [])

  function openNew() { setForm({ ...emptyForm, data_entrada: todayLocal() }); setEditing(null); setErro(''); setShowModal(true) }

  function openEdit(l: Lote) {
    setEditing(l)
    setForm({
      nome: l.nome,
      descricao: l.descricao || '',
      ua_ha: l.ua_ha != null ? l.ua_ha.toString() : '',
      data_entrada: l.data_entrada || '',
    })
    setErro('')
    setShowModal(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    const payload = {
      nome: form.nome,
      descricao: form.descricao || undefined,
      ua_ha: form.ua_ha ? parseFloat(form.ua_ha) : null,
      data_entrada: form.data_entrada || undefined,
    }
    try {
      if (editing) {
        const res = await api.put(`/lotes/${editing.id}`, payload)
        setLotes(prev => prev.map(l => l.id === editing.id ? res.data : l))
        success('Lote atualizado com sucesso!')
      } else {
        const res = await api.post('/lotes', payload)
        setLotes(prev => [...prev, res.data])
        success('Lote criado com sucesso!')
      }
      setShowModal(false)
    } catch (err: any) {
      setErro(apiErrorMessage(err, 'Erro ao salvar'))
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

  function openSaleSim(l: Lote) {
    setSaleLote(l)
    setSaleForm({
      peso_medio: '',
      preco_arroba: '',
      qtd: (l.total_animais ?? 0).toString(),
      rendimento: (l.rendimento_carcaca ?? 52).toString(),
      frete_por_animal: '',
      imposto_pct: '',
    })
  }

  function formatTempoAtivo(dias: number): string {
    if (dias < 0) return 'Inicia em breve'
    if (dias === 0) return 'Formado hoje'
    if (dias === 1) return 'Há 1 dia'
    if (dias < 30) return `Há ${dias} dias`
    if (dias < 60) return 'Há 1 mês'
    if (dias < 365) return `Há ${Math.floor(dias / 30)} meses`
    const anos = Math.floor(dias / 365)
    const mesesRestantes = Math.floor((dias % 365) / 30)
    if (mesesRestantes === 0) return anos === 1 ? 'Há 1 ano' : `Há ${anos} anos`
    return `Há ${anos} ${anos === 1 ? 'ano' : 'anos'} e ${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}`
  }

  // Cálculos do simulador (live)
  const saleResult = useMemo(() => {
    const peso = parseFloat(saleForm.peso_medio) || 0
    const preco = parseFloat(saleForm.preco_arroba) || 0
    const qtd = parseInt(saleForm.qtd) || 0
    const rend = parseFloat(saleForm.rendimento) || 52
    const frete = parseFloat(saleForm.frete_por_animal) || 0
    const impPct = parseFloat(saleForm.imposto_pct) || 0

    if (peso <= 0 || preco <= 0 || qtd <= 0) return null

    const pesoCarcaca = peso * (rend / 100)
    const arrobasPorAnimal = pesoCarcaca / 15
    const valorBrutoAnimal = arrobasPorAnimal * preco
    const totalBruto = valorBrutoAnimal * qtd
    const freteTotal = frete * qtd
    const impostoValor = totalBruto * (impPct / 100)
    const totalLiquido = totalBruto - freteTotal - impostoValor

    return {
      pesoCarcaca,
      arrobasPorAnimal,
      valorBrutoAnimal,
      totalBruto,
      freteTotal,
      impostoValor,
      totalLiquido,
      liquidoPorAnimal: totalLiquido / qtd,
    }
  }, [saleForm])

  const colors = ['var(--green-800)', 'var(--teal-600)', 'var(--blue-600)', 'var(--amber-600)', 'var(--pink-600)']

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Lotes</div>
          <div className="page-subtitle">Grupos de animais que podem ser movidos entre pastos — {lotes.length} lote(s)</div>
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
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="var(--green-700)" strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 6 }}>Nenhum lote cadastrado</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
            Um lote é um grupo de animais. Você pode alocar o grupo em diferentes pastos ao longo do tempo.
          </div>
          <button className="btn btn-primary" onClick={openNew}>Criar primeiro lote</button>
        </div>
      )}

      <div className="grid-auto">
        {lotes.map((l, i) => (
          <div key={l.id} className="card card-padded" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: colors[i % colors.length]
            }} />

            {/* Header: ícone + nome (flex grow) + botões edit/delete */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 12 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8,
                background: colors[i % colors.length] + '15',
                color: colors[i % colors.length], flexShrink: 0
              }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
              </span>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: 'var(--gray-900)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}</div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
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

            {/* Conteúdo */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)' }}>{l.total_animais ?? 0}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{l.total_animais === 1 ? 'animal' : 'animais'}</div>
              </div>

              <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                {l.pasto_atual_nome
                  ? <>Em <strong style={{ color: 'var(--gray-800)' }}>{l.pasto_atual_nome}</strong></>
                  : <span style={{ fontStyle: 'italic' }}>Sem pasto alocado</span>}
              </div>

              {l.data_entrada && (() => {
                const dias = Math.floor((Date.now() - new Date(l.data_entrada + 'T00:00').getTime()) / 86400000)
                return (
                  <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{formatTempoAtivo(dias)}</span>
                    <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>
                      ({new Date(l.data_entrada + 'T00:00').toLocaleDateString('pt-BR')})
                    </span>
                  </div>
                )
              })()}
              {l.descricao && (
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6, lineHeight: 1.4 }}>{l.descricao}</div>
              )}
            </div>

            {/* Footer do card — só Simular venda */}
            <div style={{
              marginTop: 14, paddingTop: 12,
              borderTop: '1px solid var(--gray-100)',
            }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => openSaleSim(l)}
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                title="Simular venda"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Simular venda
              </button>
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
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required autoFocus placeholder="Ex: Bezerros 2026" />
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">UA/ha consumido</label>
              <input className="form-input" type="number" inputMode="decimal" step="0.1" value={form.ua_ha} onChange={e => setForm(p => ({ ...p, ua_ha: e.target.value }))} placeholder="Ex: 1.5" />
            </div>
            <div className="form-group">
              <label className="form-label">Data de Formação</label>
              <input className="form-input" type="date" value={form.data_entrada} onChange={e => setForm(p => ({ ...p, data_entrada: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Opcional..." />
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, lineHeight: 1.4 }}>
            Para alocar este lote em um pasto, vá em <strong>Pastagens</strong> e use a ação <strong>Ocupar</strong>.
          </div>
        </form>
      </Modal>

      {/* Modal de Simulação de Venda */}
      <Modal
        open={saleLote !== null}
        onClose={() => setSaleLote(null)}
        title={`Simular venda — ${saleLote?.nome ?? ''}`}
        size="md"
        footer={
          <button className="btn btn-primary" onClick={() => setSaleLote(null)}>Fechar</button>
        }
      >
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12, lineHeight: 1.4 }}>
          Estimativa rápida do valor de venda. Use o <strong>peso médio do animal</strong> (consulta em Pesagens) e o <strong>preço da arroba</strong> da praça hoje.
        </div>

        <div className="grid-2" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label className="form-label">Peso médio do animal (kg) *</label>
            <input
              className="form-input" type="number" inputMode="decimal" step="1" autoFocus
              value={saleForm.peso_medio}
              onChange={e => setSaleForm(p => ({ ...p, peso_medio: e.target.value }))}
              placeholder="Ex: 480"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Preço da arroba (R$) *</label>
            <input
              className="form-input" type="number" inputMode="decimal" step="0.01"
              value={saleForm.preco_arroba}
              onChange={e => setSaleForm(p => ({ ...p, preco_arroba: e.target.value }))}
              placeholder="Ex: 350"
            />
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label className="form-label">Quantidade de animais</label>
            <input
              className="form-input" type="number" inputMode="decimal"
              value={saleForm.qtd}
              onChange={e => setSaleForm(p => ({ ...p, qtd: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Rendimento de carcaça (%)</label>
            <input
              className="form-input" type="number" inputMode="decimal" step="0.1"
              value={saleForm.rendimento}
              onChange={e => setSaleForm(p => ({ ...p, rendimento: e.target.value }))}
              placeholder="52"
            />
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">Frete por animal (R$)</label>
            <input
              className="form-input" type="number" inputMode="decimal" step="0.01"
              value={saleForm.frete_por_animal}
              onChange={e => setSaleForm(p => ({ ...p, frete_por_animal: e.target.value }))}
              placeholder="Opcional"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Imposto/comissão (%)</label>
            <input
              className="form-input" type="number" inputMode="decimal" step="0.01"
              value={saleForm.imposto_pct}
              onChange={e => setSaleForm(p => ({ ...p, imposto_pct: e.target.value }))}
              placeholder="Opcional"
            />
          </div>
        </div>

        {/* Resultado */}
        {saleResult ? (
          <div style={{
            background: 'var(--green-50)',
            border: '1px solid var(--green-100)',
            borderRadius: 'var(--radius)',
            padding: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-800)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Resultado
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 13, marginBottom: 12 }}>
              <div style={{ color: 'var(--gray-600)' }}>Peso carcaça/animal</div>
              <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatNumber(saleResult.pesoCarcaca, 1)} kg</div>

              <div style={{ color: 'var(--gray-600)' }}>Arrobas/animal</div>
              <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatNumber(saleResult.arrobasPorAnimal, 2)} @</div>

              <div style={{ color: 'var(--gray-600)' }}>Valor bruto/animal</div>
              <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gray-800)' }}>{formatBRL(saleResult.valorBrutoAnimal)}</div>

              <div style={{ color: 'var(--gray-600)' }}>Total bruto ({saleForm.qtd} cab)</div>
              <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gray-800)' }}>{formatBRL(saleResult.totalBruto)}</div>

              {(saleResult.freteTotal > 0 || saleResult.impostoValor > 0) && <>
                {saleResult.freteTotal > 0 && <>
                  <div style={{ color: 'var(--red-600)' }}>− Frete total</div>
                  <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--red-600)' }}>−{formatBRL(saleResult.freteTotal)}</div>
                </>}
                {saleResult.impostoValor > 0 && <>
                  <div style={{ color: 'var(--red-600)' }}>− Imposto/comissão</div>
                  <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--red-600)' }}>−{formatBRL(saleResult.impostoValor)}</div>
                </>}
              </>}
            </div>

            <div style={{ borderTop: '1px solid var(--green-100)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-800)' }}>Líquido total</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green-700)' }}>{formatBRL(saleResult.totalLiquido)}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', textAlign: 'right', marginTop: 2 }}>
              {formatBRL(saleResult.liquidoPorAnimal)} por animal
            </div>
          </div>
        ) : (
          <div style={{ padding: 14, background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--gray-500)', textAlign: 'center' }}>
            Preencha peso médio, preço da arroba e quantidade para ver o resultado.
          </div>
        )}
      </Modal>
    </div>
  )
}
