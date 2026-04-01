import { useState, useRef } from 'react'
import { useToast } from '../components/Toast'

const BASE_URL = '/api'

type Relatorio = {
  titulo: string
  descricao: string
  endpoint: string
  cor: string
  bg: string
  icone: string
}

const relatorios: Relatorio[] = [
  {
    titulo: 'Rebanho completo',
    descricao: 'Todos os animais ativos com dados cadastrais',
    endpoint: '/relatorios/animais.csv',
    cor: 'var(--green-800)',
    bg: 'var(--green-100)',
    icone: '🐄',
  },
  {
    titulo: 'Histórico de pesagens',
    descricao: 'Todas as pesagens registradas por animal',
    endpoint: '/relatorios/pesagens.csv',
    cor: 'var(--amber-600)',
    bg: 'var(--amber-100)',
    icone: '⚖️',
  },
  {
    titulo: 'Relatório financeiro',
    descricao: 'Compras, vendas e custos de saúde',
    endpoint: '/relatorios/financeiro.csv',
    cor: 'var(--blue-600)',
    bg: 'var(--blue-100)',
    icone: '💰',
  },
]

export default function Relatorios() {
  const { success, error: toastError } = useToast()
  const [baixando, setBaixando] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    try {
      const token = localStorage.getItem('token')
      const form = new FormData()
      form.append('file', file)
      const resp = await fetch(BASE_URL + '/relatorios/animais/importar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Erro')
      const msg = `${data.importados} animal(is) importado(s)` +
        (data.erros?.length ? ` • ${data.erros.length} erro(s)` : '')
      success(msg)
    } catch (err: any) {
      toastError(err.message || 'Erro ao importar CSV')
    } finally {
      setImportando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function baixar(r: Relatorio) {
    setBaixando(r.endpoint)
    try {
      const token = localStorage.getItem('token')
      const resp = await fetch(BASE_URL + r.endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error()
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = r.endpoint.split('/').pop()!
      a.click()
      URL.revokeObjectURL(url)
      success(`${r.titulo} exportado com sucesso!`)
    } catch {
      toastError('Erro ao exportar relatório')
    } finally {
      setBaixando(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Relatórios</div>
          <div className="page-subtitle">Exporte seus dados em formato CSV</div>
        </div>
      </div>

      {/* Importação */}
      <div className="card card-padded" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)', marginBottom: 4 }}>
              📤 Importar animais via CSV
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              Colunas: <code>Brinco</code>, <code>Nome</code>, <code>Raça</code>, <code>Sexo</code>, <code>Origem</code>, <code>Peso Entrada (kg)</code>
            </div>
          </div>
          <div>
            <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={importarCSV} />
            <button
              className="btn btn-primary"
              onClick={() => inputRef.current?.click()}
              disabled={importando}
            >
              {importando ? <><span className="spinner" /> Importando...</> : '📂 Selecionar CSV'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid-auto">
        {relatorios.map(r => (
          <div key={r.endpoint} className="card card-padded" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: r.cor }} />
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, borderRadius: 10, background: r.bg, fontSize: 20,
                }}>{r.icone}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>{r.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>{r.descricao}</div>
                </div>
              </div>
              <button
                className="btn btn-outline"
                style={{ color: r.cor, borderColor: r.cor, width: '100%', justifyContent: 'center' }}
                onClick={() => baixar(r)}
                disabled={baixando === r.endpoint}
              >
                {baixando === r.endpoint
                  ? <><span className="spinner" /> Exportando...</>
                  : '⬇️ Baixar CSV'
                }
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
