import { useState, useRef, ReactNode } from 'react'
import { useToast } from '../components/Toast'
import { todayLocal } from '../utils/date'

const BASE_URL = '/api'

type Formato = { ext: 'csv' | 'xlsx' | 'pdf'; label: string }

type Relatorio = {
  titulo: string
  descricao: string
  base: string  // ex: '/relatorios/animais' (sem extensao)
  cor: string
  bg: string
  icone: ReactNode
  formatos: Formato[]
}

const IconCow = (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
  </svg>
)
const IconScale = (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5 5 0 006.9 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.9 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V6m0 16H9m3 0h3"/>
  </svg>
)
const IconCash = (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)
const IconReport = (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
  </svg>
)
const IconUpload = (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-9l-4-4m0 0l-4 4m4-4v12"/>
  </svg>
)
const IconDownload = (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-5l-4 4m0 0l-4-4m4 4V4"/>
  </svg>
)

const relatorios: Relatorio[] = [
  {
    titulo: 'Rebanho completo',
    descricao: 'Todos os animais ativos com dados cadastrais',
    base: '/relatorios/animais',
    cor: 'var(--green-800)',
    bg: 'var(--green-100)',
    icone: IconCow,
    formatos: [
      { ext: 'csv', label: 'CSV' },
      { ext: 'xlsx', label: 'Excel' },
      { ext: 'pdf', label: 'PDF' },
    ],
  },
  {
    titulo: 'Histórico de pesagens',
    descricao: 'Todas as pesagens registradas por animal',
    base: '/relatorios/pesagens',
    cor: 'var(--amber-600)',
    bg: 'var(--amber-100)',
    icone: IconScale,
    formatos: [
      { ext: 'csv', label: 'CSV' },
      { ext: 'xlsx', label: 'Excel' },
    ],
  },
  {
    titulo: 'Movimentações financeiras',
    descricao: 'Compras, vendas e custos de saúde',
    base: '/relatorios/financeiro',
    cor: 'var(--blue-600)',
    bg: 'var(--blue-100)',
    icone: IconCash,
    formatos: [
      { ext: 'csv', label: 'CSV' },
      { ext: 'xlsx', label: 'Excel' },
    ],
  },
]

export default function Relatorios() {
  const { success, error: toastError } = useToast()
  const [baixando, setBaixando] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Resumo contabil
  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const [contadorInicio, setContadorInicio] = useState(inicioMes.toISOString().split('T')[0])
  const [contadorFim, setContadorFim] = useState(hoje.toISOString().split('T')[0])

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

  async function baixar(url: string, filename: string, key: string, titulo: string) {
    setBaixando(key)
    try {
      const token = localStorage.getItem('token')
      const resp = await fetch(BASE_URL + url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error()
      const blob = await resp.blob()
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = dlUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(dlUrl)
      success(`${titulo} exportado!`)
    } catch {
      toastError('Erro ao exportar relatório')
    } finally {
      setBaixando(null)
    }
  }

  async function baixarContador() {
    if (!contadorInicio || !contadorFim) {
      toastError('Selecione o período')
      return
    }
    if (contadorFim < contadorInicio) {
      toastError('Data fim anterior à data início')
      return
    }
    const url = `/relatorios/resumo-contador.pdf?data_inicio=${contadorInicio}&data_fim=${contadorFim}`
    await baixar(url, `resumo_contabil_${contadorInicio}_${contadorFim}.pdf`, 'contador', 'Resumo contábil')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Relatórios</div>
          <div className="page-subtitle">Exporte dados em CSV, Excel ou PDF</div>
        </div>
      </div>

      {/* Importação */}
      <div className="card card-padded" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: 'var(--gray-900)', marginBottom: 4 }}>
              {IconUpload} Importar animais via CSV
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
              {importando ? <><span className="spinner" /> Importando...</> : <>{IconUpload} Selecionar CSV</>}
            </button>
          </div>
        </div>
      </div>

      <div className="grid-auto">
        {relatorios.map(r => (
          <div key={r.base} className="card card-padded" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: r.cor }} />
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, borderRadius: 10, background: r.bg, color: r.cor,
                }}>{r.icone}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>{r.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{r.descricao}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {r.formatos.map(f => {
                  const url = `${r.base}.${f.ext}`
                  const filename = `${r.base.split('/').pop()}_${todayLocal()}.${f.ext}`
                  const key = `${r.base}.${f.ext}`
                  return (
                    <button
                      key={f.ext}
                      className="btn btn-outline btn-sm"
                      style={{ color: r.cor, borderColor: r.cor, flex: '1 1 auto', justifyContent: 'center' }}
                      onClick={() => baixar(url, filename, key, `${r.titulo} (${f.label})`)}
                      disabled={baixando === key}
                    >
                      {baixando === key
                        ? <><span className="spinner" /> ...</>
                        : <>{IconDownload} {f.label}</>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Resumo contábil */}
      <div style={{ marginTop: 32 }}>
        <div className="page-subtitle" style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          Para o contador
        </div>
        <div className="card card-padded" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--teal-600)' }} />
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: 10, background: 'var(--teal-100)', color: 'var(--teal-600)',
              }}>{IconReport}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>Resumo contábil consolidado</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                  Receita líquida, custos (compras, fretes, saúde, despesas pro rata) e lucro consolidado do período
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label className="form-label">Período</label>
                <input className="form-input" type="date" value={contadorInicio} onChange={e => setContadorInicio(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label className="form-label">&nbsp;até</label>
                <input className="form-input" type="date" value={contadorFim} onChange={e => setContadorFim(e.target.value)} />
              </div>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--teal-600)' }}
                onClick={baixarContador}
                disabled={baixando === 'contador'}
              >
                {baixando === 'contador'
                  ? <><span className="spinner" /> Gerando...</>
                  : <>{IconDownload} Gerar PDF</>}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              Dica: para o relatório anual, selecione 1º de janeiro a 31 de dezembro.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
