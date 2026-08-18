/** Formata um Date no fuso local (YYYY-MM-DD). NAO use toISOString() — vira UTC. */
export function toLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Data de hoje no fuso local (YYYY-MM-DD). */
export function todayLocal(): string {
  return toLocalDate(new Date())
}

/** Soma n dias a uma data ISO (YYYY-MM-DD) e retorna outra ISO local. */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00')
  d.setDate(d.getDate() + n)
  return toLocalDate(d)
}

/** Formata uma data ISO (YYYY-MM-DD) como dd/mm/aaaa. */
export function formatBRISO(iso: string): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00').toLocaleDateString('pt-BR')
}
