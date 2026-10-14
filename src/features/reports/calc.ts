import { shiftMonth, type YearMonth } from '@/lib/dates'

export type ReportItem = {
  kind: 'income' | 'expense' | 'transfer'
  amount: number
  occurred_on: string
  category_id: string | null
  status: 'paid' | 'pending'
}

const toCents = (n: number) => Math.round(n * 100)

export type PeriodKey = '3m' | '6m' | '12m' | 'year'

/** Primeiro e último mês do período, terminando no mês de referência. */
export function periodRange(key: PeriodKey, reference: YearMonth): { from: YearMonth; to: YearMonth; months: number } {
  if (key === 'year') {
    const from = `${reference.slice(0, 4)}-01`
    const months = Number(reference.slice(5, 7))
    return { from, to: reference, months }
  }
  const months = key === '3m' ? 3 : key === '6m' ? 6 : 12
  return { from: shiftMonth(reference, -(months - 1)), to: reference, months }
}

export function totals(items: ReportItem[]) {
  let income = 0
  let expense = 0
  for (const t of items) {
    if (t.kind === 'income') income += toCents(t.amount)
    else if (t.kind === 'expense') expense += toCents(t.amount)
  }
  const balance = income - expense
  return {
    income: income / 100,
    expense: expense / 100,
    balance: balance / 100,
    /** Parte da renda que sobrou (resultado ÷ receitas), em %. Null sem receitas. */
    savingsRate: income > 0 ? (balance / income) * 100 : null,
  }
}

export type CategoryShare = { categoryId: string | null; amount: number; share: number }

/** Despesas por categoria, da maior para a menor, com a participação no total (%). */
export function expensesByCategory(items: ReportItem[]): CategoryShare[] {
  const map = new Map<string | null, number>()
  let total = 0
  for (const t of items) {
    if (t.kind !== 'expense') continue
    const c = toCents(t.amount)
    total += c
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + c)
  }
  return [...map.entries()]
    .map(([categoryId, c]) => ({ categoryId, amount: c / 100, share: total > 0 ? (c / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

export type CategoryComparison = {
  categoryId: string | null
  current: number
  previous: number
  diff: number
  /** Variação em %; null quando o mês anterior foi zero. */
  change: number | null
}

/** Despesas por categoria no mês `month` comparadas com o mês anterior. */
export function compareMonths(items: ReportItem[], month: YearMonth): CategoryComparison[] {
  const previousMonth = shiftMonth(month, -1)
  const cur = new Map<string | null, number>()
  const prev = new Map<string | null, number>()
  for (const t of items) {
    if (t.kind !== 'expense') continue
    const m = t.occurred_on.slice(0, 7)
    const target = m === month ? cur : m === previousMonth ? prev : null
    if (!target) continue
    target.set(t.category_id, (target.get(t.category_id) ?? 0) + toCents(t.amount))
  }
  const keys = new Set([...cur.keys(), ...prev.keys()])
  return [...keys]
    .map((categoryId) => {
      const c = cur.get(categoryId) ?? 0
      const p = prev.get(categoryId) ?? 0
      return {
        categoryId,
        current: c / 100,
        previous: p / 100,
        diff: (c - p) / 100,
        change: p > 0 ? ((c - p) / p) * 100 : null,
      }
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
}

function csvCell(value: string) {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * CSV no padrão do Excel em português: separador ";" e vírgula decimal.
 * Começa com BOM para os acentos abrirem certo.
 */
export function toCsv(header: string[], rows: Array<Array<string | number>>): string {
  const format = (v: string | number) =>
    typeof v === 'number' ? v.toFixed(2).replace('.', ',') : csvCell(v)
  const lines = [header.map(csvCell).join(';'), ...rows.map((r) => r.map(format).join(';'))]
  return '﻿' + lines.join('\r\n') + '\r\n'
}
