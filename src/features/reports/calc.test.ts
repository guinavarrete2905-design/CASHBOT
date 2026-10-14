import { describe, expect, it } from 'vitest'
import { compareMonths, expensesByCategory, periodRange, toCsv, totals, type ReportItem } from './calc'

const item = (p: Partial<ReportItem>): ReportItem => ({
  kind: 'expense',
  amount: 0,
  occurred_on: '2026-10-01',
  category_id: null,
  status: 'paid',
  ...p,
})

describe('relatórios', () => {
  it('monta o período', () => {
    expect(periodRange('3m', '2026-02')).toEqual({ from: '2025-12', to: '2026-02', months: 3 })
    expect(periodRange('12m', '2026-10')).toEqual({ from: '2025-11', to: '2026-10', months: 12 })
    expect(periodRange('year', '2026-10')).toEqual({ from: '2026-01', to: '2026-10', months: 10 })
  })

  it('soma receitas e despesas e ignora transferências', () => {
    expect(
      totals([
        item({ kind: 'income', amount: 5000 }),
        item({ amount: 0.1 }),
        item({ amount: 0.2 }),
        item({ amount: 3999.7 }),
        item({ kind: 'transfer', amount: 999 }),
      ]),
    ).toEqual({ income: 5000, expense: 4000, balance: 1000, savingsRate: 20 })
    expect(totals([item({ amount: 10 })]).savingsRate).toBeNull()
  })

  it('agrupa despesas por categoria com participação', () => {
    const result = expensesByCategory([
      item({ amount: 300, category_id: 'a' }),
      item({ amount: 100, category_id: 'b' }),
      item({ amount: 100, category_id: 'a' }),
      item({ kind: 'income', amount: 1000, category_id: 'c' }),
    ])
    expect(result).toEqual([
      { categoryId: 'a', amount: 400, share: 80 },
      { categoryId: 'b', amount: 100, share: 20 },
    ])
  })

  it('compara o mês com o anterior', () => {
    const result = compareMonths(
      [
        item({ amount: 150, category_id: 'a', occurred_on: '2026-10-05' }),
        item({ amount: 100, category_id: 'a', occurred_on: '2026-09-05' }),
        item({ amount: 50, category_id: 'b', occurred_on: '2026-10-05' }),
        item({ amount: 80, category_id: 'c', occurred_on: '2026-09-20' }),
        item({ amount: 999, category_id: 'a', occurred_on: '2026-08-01' }),
      ],
      '2026-10',
    )
    expect(result).toEqual([
      { categoryId: 'c', current: 0, previous: 80, diff: -80, change: -100 },
      { categoryId: 'a', current: 150, previous: 100, diff: 50, change: 50 },
      { categoryId: 'b', current: 50, previous: 0, diff: 50, change: null },
    ])
  })

  it('gera CSV no padrão brasileiro', () => {
    const csv = toCsv(['Data', 'Descrição', 'Valor'], [['14/10/2026', 'Mercado; feira', 1234.5]])
    expect(csv).toBe('﻿Data;Descrição;Valor\r\n14/10/2026;"Mercado; feira";1234,50\r\n')
  })
})
