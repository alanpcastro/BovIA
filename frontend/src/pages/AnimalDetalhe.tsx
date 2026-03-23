import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api, { Animal, Pesagem, Saude, Reproducao, Movimentacao, Lote } from '../services/api'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 20 }
const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const }
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: '#374151', borderTop: '1px solid #f3f4f6' }
const btn = (v = 'primary'): React.CSSProperties => ({
  padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  background: v === 'primary' ? '#2d6a4f' : v === 'danger' ? '#dc2626' : '#f3f4f6',
  color: v === 'ghost' ? '#374151' : '#fff',
})

interface Historico { animal: Animal; pesagens: Pesagem[]; saudes: Saude[]; reproducoes: Reproducao[]; movimentacoes: Movimentacao[] }

export default function AnimalDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [hist, setHist] = useState<Historico | null>(null)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [tab, setTab] = useState<'pesagens' | 'saude' | 'reproducao' | 'movimentacoes'>('pesagens')
  const [editStatus, setEditStatus] = useState(false)
  const [novoStatus, setNovoStatus] = useState('')

  function load() {
    api.get(`/animais/${id}/historico`).then(r => {
      setHist(r.data)
      setNovoStatus(r.data.animal.status)
    })
  }

  useEffect(() => { load(); api.get('/lotes').then(r => setLotes(r.data)) }, [id])

  async function salvarStatus() {
    await api.put(`/animais/${id}`, { status: novoStatus })
    setEditStatus(false)
    load()
  }

  async function deletar() {
    if (!confirm('Excluir este animal permanentemente?')) return
    await api.delete(`/animais/${id}`)
    navigate('/animais')
  }

  if (!hist) return <div style={{ color: '#9ca3af' }}>Carregando...</div>

  const { animal } = hist
  const loteNome = lotes.find(l => l.id === animal.lote_id)?.nome
  const statusColor: Record<string, string> = { ativo: '#16a34a', vendido: '#3b82f6', morto: '#6b7280', transferido: '#d97706' }

  const tabs = [
    { key: 'pesagens', label: `⚖️ Pesagens (${hist.pesagens.length})` },
    { key: 'saude', label: `💉 Saúde (${hist.saudes.length})` },
    { key: 'reproducao', label: `🐮 Reprodução (${hist.reproducoes.length})` },
    { key: 'movimentacoes', label: `💰 Movimentações (${hist.movimentacoes.length})` },
  ] as const

  return (
    <div>
      <button onClick={() => navigate('/animais')} style={{ ...btn('ghost'), marginBottom: 20, fontSize: 13 }}>← Voltar</button>

      {/* Cabeçalho */}
      <div style={{ ...card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>🐄 Brinco #{animal.brinco}{animal.nome ? ` — ${animal.nome}` : ''}</div>
            <div style={{ color: '#6b7280', marginTop: 4, fontSize: 14 }}>
              {animal.sexo === 'macho' ? '♂ Macho' : '♀ Fêmea'} · {animal.raca || 'Raça não informada'} · {loteNome ? `Lote: ${loteNome}` : 'Sem lote'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {editStatus ? (
              <>
                <select value={novoStatus} onChange={e => setNovoStatus(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
                  <option value="ativo">Ativo</option>
                  <option value="vendido">Vendido</option>
                  <option value="morto">Morto</option>
                  <option value="transferido">Transferido</option>
                </select>
                <button style={btn()} onClick={salvarStatus}>Salvar</button>
                <button style={btn('ghost')} onClick={() => setEditStatus(false)}>Cancelar</button>
              </>
            ) : (
              <>
                <span style={{ background: statusColor[animal.status] + '20', color: statusColor[animal.status], padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                  {animal.status}
                </span>
                <button style={btn('ghost')} onClick={() => setEditStatus(true)}>Mudar status</button>
                <button style={btn('danger')} onClick={deletar}>Excluir</button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20 }}>
          {[
            { label: 'Data de Nascimento', value: animal.data_nascimento ? new Date(animal.data_nascimento + 'T00:00').toLocaleDateString('pt-BR') : '—' },
            { label: 'Peso de Entrada', value: animal.peso_entrada ? `${animal.peso_entrada} kg` : '—' },
            { label: 'Origem', value: animal.origem || '—' },
            { label: 'Cadastrado em', value: new Date(animal.created_at).toLocaleDateString('pt-BR') },
          ].map(i => (
            <div key={i.label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 }}>{i.label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{i.value}</div>
            </div>
          ))}
        </div>

        {animal.observacoes && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#6b7280' }}>
            {animal.observacoes}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? '#2d6a4f' : '#6b7280', borderBottom: tab === t.key ? '2px solid #2d6a4f' : '2px solid transparent', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pesagens' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontWeight: 600 }}>Histórico de Pesagens</h3>
            <button style={btn()} onClick={() => navigate(`/pesagens?animal_id=${id}`)}>+ Registrar Pesagem</button>
          </div>
          {hist.pesagens.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 14 }}>Sem pesagens registradas.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Data</th><th style={th}>Peso</th><th style={th}>GMD (kg/dia)</th><th style={th}>Observações</th></tr></thead>
              <tbody>
                {hist.pesagens.map(p => (
                  <tr key={p.id}>
                    <td style={td}>{new Date(p.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{p.peso_kg} kg</td>
                    <td style={{ ...td, color: p.gmd && p.gmd > 0 ? '#16a34a' : '#dc2626' }}>{p.gmd != null ? `${p.gmd > 0 ? '+' : ''}${p.gmd}` : '—'}</td>
                    <td style={{ ...td, color: '#9ca3af' }}>{p.observacoes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'saude' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontWeight: 600 }}>Histórico de Saúde</h3>
            <button style={btn()} onClick={() => navigate(`/saude?animal_id=${id}`)}>+ Registrar</button>
          </div>
          {hist.saudes.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 14 }}>Sem registros de saúde.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Data</th><th style={th}>Tipo</th><th style={th}>Descrição</th><th style={th}>Medicamento</th><th style={th}>Custo</th><th style={th}>Próxima</th></tr></thead>
              <tbody>
                {hist.saudes.map(s => (
                  <tr key={s.id}>
                    <td style={td}>{new Date(s.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={td}>{s.tipo.replace('_', ' ')}</td>
                    <td style={td}>{s.descricao}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{s.medicamento || '—'}</td>
                    <td style={td}>{s.custo != null ? `R$ ${s.custo.toFixed(2)}` : '—'}</td>
                    <td style={{ ...td, color: s.proxima_data ? '#d97706' : '#9ca3af' }}>
                      {s.proxima_data ? new Date(s.proxima_data + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'reproducao' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontWeight: 600 }}>Reprodução</h3>
            <button style={btn()} onClick={() => navigate(`/reproducao?animal_id=${id}`)}>+ Registrar</button>
          </div>
          {hist.reproducoes.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 14 }}>Sem registros reprodutivos.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Data</th><th style={th}>Tipo</th><th style={th}>Resultado</th><th style={th}>Touro</th><th style={th}>Parto Previsto</th></tr></thead>
              <tbody>
                {hist.reproducoes.map(r => (
                  <tr key={r.id}>
                    <td style={td}>{new Date(r.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={td}>{r.tipo.replace(/_/g, ' ')}</td>
                    <td style={td}>{r.resultado || '—'}</td>
                    <td style={{ ...td, color: '#6b7280' }}>{r.touro_brinco || '—'}</td>
                    <td style={{ ...td, color: '#2d6a4f' }}>
                      {r.data_prevista_parto ? new Date(r.data_prevista_parto + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'movimentacoes' && (
        <div style={card}>
          <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Movimentações</h3>
          {hist.movimentacoes.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 14 }}>Sem movimentações.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Data</th><th style={th}>Tipo</th><th style={th}>Valor</th><th style={th}>Peso</th><th style={th}>Observações</th></tr></thead>
              <tbody>
                {hist.movimentacoes.map(m => (
                  <tr key={m.id}>
                    <td style={td}>{new Date(m.data + 'T00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={td}>{m.tipo}</td>
                    <td style={td}>{m.valor != null ? `R$ ${m.valor.toFixed(2)}` : '—'}</td>
                    <td style={td}>{m.peso_kg ? `${m.peso_kg} kg` : '—'}</td>
                    <td style={{ ...td, color: '#9ca3af' }}>{m.observacoes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
