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
