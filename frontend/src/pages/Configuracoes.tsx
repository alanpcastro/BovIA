import { useState, useRef } from 'react'
import api from '../services/api'
import { useToast } from '../components/Toast'
import { todayLocal } from '../utils/date'
import { apiErrorMessage } from '../utils/apiError'

export default function Configuracoes() {
  const { success, error: toastError } = useToast()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/backup/export')
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bovia-backup-${todayLocal()}.json`
      a.click()
      URL.revokeObjectURL(url)
      success('Backup exportado')
    } catch {
      toastError('Erro ao exportar backup')
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('Importar este backup vai adicionar os dados ao seu cadastro atual. Continuar?')) {
      e.target.value = ''
      return
    }
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/backup/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const counts = res.data.importados as Record<string, number>
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      success(`Importação concluída: ${total} registro(s)`)
    } catch (err: any) {
      toastError(apiErrorMessage(err, 'Erro ao importar backup'))
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Configurações</div>
          <div className="page-subtitle">Backup, preferências e administração</div>
        </div>
      </div>

      <div className="card card-padded" style={{ marginBottom: 20, maxWidth: 720 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Backup dos dados</h3>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
          Exporte um arquivo JSON com todos os seus dados (animais, lotes, pesagens, saúde, reprodução, movimentações, custos e despesas). Guarde em local seguro.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? <><span className="spinner" /> Exportando...</> : 'Exportar backup (JSON)'}
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <><span className="spinner spinner-dark" /> Importando...</> : 'Importar backup'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
        <div className="alert alert-warning" style={{ marginTop: 16 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          A importação <strong>adiciona</strong> os registros ao cadastro atual (não substitui). Para evitar duplicatas, importe apenas em conta vazia.
        </div>
      </div>
    </div>
  )
}
