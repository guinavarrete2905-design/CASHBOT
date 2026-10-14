import { parseISODate, shiftMonth, todayISO, type YearMonth } from '@/lib/dates'

/*
  Regras de fatura de cartão de crédito.
  - Cada fatura é identificada pelo mês em que FECHA.
  - Compras até o dia de fechamento (inclusive) entram na fatura daquele mês; depois disso, na do mês seguinte.
  - O vencimento cai no mesmo mês do fechamento quando o dia de vencimento é maior que o de fechamento;
    senão, no mês seguinte.
  - Dias que não existem no mês (ex.: 31 em fevereiro) viram o último dia do mês.
*/

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function daysInMonth(ym: YearMonth) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** Data (AAAA-MM-DD) do dia `day` no mês, limitada ao último dia do mês. */
export function dayInMonth(ym: YearMonth, day: number): string {
  return `${ym}-${pad(Math.min(day, daysInMonth(ym)))}`
}

/** Mês de fechamento da fatura em que uma compra feita em `dateISO` entra. */
export function invoiceMonthFor(dateISO: string, closingDay: number): YearMonth {
  const ym = dateISO.slice(0, 7)
  return dateISO <= dayInMonth(ym, closingDay) ? ym : shiftMonth(ym, 1)
}

export type InvoicePeriod = {
  /** Mês de fechamento (identifica a fatura). */
  month: YearMonth
  /** Primeiro dia de compras desta fatura. */
  start: string
  /** Dia do fechamento (último dia de compras, inclusive). */
  closing: string
  /** Dia do vencimento. */
  due: string
}

function nextDay(iso: string) {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + 1)
  return todayISO(d)
}

export function invoicePeriod(month: YearMonth, closingDay: number, dueDay: number): InvoicePeriod {
  const closing = dayInMonth(month, closingDay)
  const previousClosing = dayInMonth(shiftMonth(month, -1), closingDay)
  const dueMonth = dueDay > closingDay ? month : shiftMonth(month, 1)
  return { month, start: nextDay(previousClosing), closing, due: dayInMonth(dueMonth, dueDay) }
}

/** Fatura aberta hoje (ainda recebendo compras) e a última fechada. */
export function currentInvoices(closingDay: number, dueDay: number, today = todayISO()) {
  const openMonth = invoiceMonthFor(today, closingDay)
  return {
    open: invoicePeriod(openMonth, closingDay, dueDay),
    closed: invoicePeriod(shiftMonth(openMonth, -1), closingDay, dueDay),
  }
}

type CardMovement = { kind: 'income' | 'expense' | 'transfer'; amount: number; occurred_on: string; account_id: string | null }

/** Total de uma fatura: compras menos estornos lançados no cartão dentro do período. Pagamentos não entram. */
export function invoiceTotal(movements: CardMovement[], cardId: string, period: InvoicePeriod): number {
  let cents = 0
  for (const m of movements) {
    if (m.account_id !== cardId) continue
    if (m.occurred_on < period.start || m.occurred_on > period.closing) continue
    if (m.kind === 'expense') cents += Math.round(m.amount * 100)
    else if (m.kind === 'income') cents -= Math.round(m.amount * 100)
  }
  return cents / 100
}
