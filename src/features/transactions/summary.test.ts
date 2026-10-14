import { describe, expect, it } from 'vitest'
import { groupByDay, statusLabel, summarize } from './summary'

describe('summarize', () => {
  it('soma receitas e despesas e calcula o resultado', () => {
    const totals = summarize([
      { kind: 'income', status: 'paid', amount: 5000 },
      { kind: 'expense', status: 'paid', amount: 0.1 },
      { kind: 'expense', status: 'paid', amount: 0.2 },
      { kind: 'expense', status: 'pending', amount: 1200 },
      { kind: 'income', status: 'pending', amount: 300.5 },
    ])
    expect(totals).toEqual({
      income: 5300.5,
      expense: 1200.3,
      balance: 4100.2,
      pendingIncome: 300.5,
      pendingExpense: 1200,
    })
  })

  it('ignora transferências entre contas', () => {
    expect(
      summarize([
        { kind: 'transfer', status: 'paid', amount: 1000 },
        { kind: 'expense', status: 'paid', amount: 10 },
      ]),
    ).toEqual({ income: 0, expense: 10, balance: -10, pendingIncome: 0, pendingExpense: 0 })
  })

  it('zera quando não há movimentações', () => {
    expect(summarize([])).toEqual({ income: 0, expense: 0, balance: 0, pendingIncome: 0, pendingExpense: 0 })
  })
})

describe('statusLabel', () => {
  it('usa o verbo certo para receita e despesa', () => {
    expect(statusLabel('income', 'paid')).toBe('Recebida')
    expect(statusLabel('income', 'pending')).toBe('A receber')
    expect(statusLabel('expense', 'paid')).toBe('Paga')
    expect(statusLabel('expense', 'pending')).toBe('A pagar')
    expect(statusLabel('transfer', 'pending')).toBe('Agendada')
  })
})

describe('groupByDay', () => {
  it('agrupa dias consecutivos na ordem recebida', () => {
    const groups = groupByDay([
      { id: 1, occurred_on: '2026-10-14' },
      { id: 2, occurred_on: '2026-10-14' },
      { id: 3, occurred_on: '2026-10-12' },
    ])
    expect(groups.map((g) => [g.day, g.items.length])).toEqual([
      ['2026-10-14', 2],
      ['2026-10-12', 1],
    ])
  })
})
