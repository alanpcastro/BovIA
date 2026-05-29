// Extrai uma mensagem legivel de um erro do axios/FastAPI.
// FastAPI 422 retorna detail como ARRAY de objetos {type, loc, msg, ...} — nao da pra
// renderizar direto no React (crash "Objects are not valid as a React child").
export function apiErrorMessage(err: any, fallback: string = 'Erro inesperado'): string {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    // junta msg de cada validacao em uma linha so
    return detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail)
  if (err?.message) return err.message
  return fallback
}
