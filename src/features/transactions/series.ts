import { parseISODate, todayISO } from '@/lib/dates'
import type { TransactionStatus } from './summary'

export type SeriesKind = 'installment' | 'recurring'
export type SeriesScope = 'this' | 'next' | 'all'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Soma `months` meses a uma data mantendo o dia original quando possível
 * (31/01 + 1 mês → 28/02 ou 29/02; + 2 meses → 31/03).
 */
export function addMonthsKeepingDay(iso: string, months: number): string {
  const start = parseISODate(iso)
  const day = start.getDate()
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(Math.min(day, lastDay))}`
}

/** Divide um total em parcelas iguais; os centavos que sobram vão para as primeiras. */
export function splitAmount(total: number, count: number): number[] {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100)
}

export type SeriesItem = {
  index: number
  occurredOn: string
  amount: number
  status: TransactionStatus
}

/**
 * Gera as ocorrências de uma série.
 * - Parcelado: `amount` é o valor TOTAL, dividido entre as parcelas.
 * - Mensal: `amount` é o valor de CADA mês.
 * Ocorrências com data futura ficam pendentes; as até hoje usam a situação escolhida.
 */
export function buildSeries(params: {
  kind: SeriesKind
  amount: number
  count: number
  start: string
  status: TransactionStatus
  /** Ocorrências com data futura ficam pendentes (padrão). Desligado para compras no cartão. */
  futurePending?: boolean
  today?: string
}): SeriesItem[] {
  const today = params.today ?? todayISO()
  const amounts: number[] =
    params.kind === 'installment'
      ? splitAmount(params.amount, params.count)
      : Array.from({ length: params.count }, () => params.amount)
  return amounts.map((amount, i) => {
    const occurredOn = addMonthsKeepingDay(params.start, i)
    return {
      index: i + 1,
      occurredOn,
      amount,
      status: params.futurePending !== false && occurredOn > today ? 'pending' : params.status,
    }
  })
}

/** Texto curto da posição na série: "3/10" para parcelas, "mensal" para recorrências. */
export function seriesLabel(kind: SeriesKind | null, index: number | null, total: number | null): string | null {
  if (!kind || !index || !total) return null
  return kind === 'installment' ? `${index}/${total}` : `mensal ${index}/${total}`
}

export const SCOPE_LABEL: Record<SeriesScope, string> = {
  this: 'Só esta',
  next: 'Esta e as próximas',
  all: 'Todas',
}
