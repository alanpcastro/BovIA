// Formatação numérica padrão pt-BR: ponto nos milhares, vírgula nos decimais.

/** Número com separador de milhar e N casas decimais. Ex: 2000.5 → "2.000,50" */
export function formatNumber(n: number | null | undefined, decimals: number = 0): string {
  if (n == null || Number.isNaN(n)) return '0'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** Currency BRL. Ex: 2000.5 → "R$ 2.000,50" */
export function formatBRL(n: number | null | undefined, decimals: number = 2): string {
  if (n == null || Number.isNaN(n)) return 'R$ 0,00'
  return `R$ ${formatNumber(n, decimals)}`
}

/** Peso em kg. Ex: 320 → "320 kg"; 1250.5 → "1.250,5 kg" */
export function formatKg(n: number | null | undefined, decimals: number = 0): string {
  if (n == null || Number.isNaN(n)) return '— kg'
  return `${formatNumber(n, decimals)} kg`
}

/** Percentual. Ex: 52.3 → "52,3%" */
export function formatPct(n: number | null | undefined, decimals: number = 1): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${formatNumber(n, decimals)}%`
}

/** Arrobas. Ex: 15.5 → "15,5 @" */
export function formatArroba(n: number | null | undefined, decimals: number = 1): string {
  if (n == null || Number.isNaN(n)) return '— @'
  return `${formatNumber(n, decimals)} @`
}
