/** Mês no formato "AAAA-MM". */
export type YearMonth = string

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Data local de hoje em "AAAA-MM-DD" (sem efeito de fuso horário). */
export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function currentYearMonth(now = new Date()): YearMonth {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

export function isYearMonth(value: string | null | undefined): value is YearMonth {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value))
}

/** Lê "AAAA-MM-DD" como data local. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/** Intervalo do mês: primeiro dia (inclusivo) e primeiro dia do mês seguinte (exclusivo). */
export function monthRange(ym: YearMonth): { start: string; endExclusive: string } {
  return { start: `${ym}-01`, endExclusive: `${shiftMonth(ym, 1)}-01` }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "2026-10" → "Outubro de 2026". */
export function formatMonth(ym: YearMonth): string {
  return capitalize(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(parseISODate(`${ym}-01`)))
}

/** "2026-10" → "out." (rótulo curto para gráficos). */
export function formatMonthShort(ym: YearMonth): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(parseISODate(`${ym}-01`)).replace('.', '')
}

/** "2026-10-14" → "Quarta-feira, 14 de outubro" (com "Hoje"/"Ontem" quando couber). */
export function formatDayHeading(iso: string, now = new Date()): string {
  const today = todayISO(now)
  const yesterday = todayISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  if (iso === today) return 'Hoje'
  if (iso === yesterday) return 'Ontem'
  return capitalize(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseISODate(iso)))
}

/** "2026-10-14" → "14/10". */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
