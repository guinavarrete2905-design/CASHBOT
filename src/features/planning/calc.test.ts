import { describe, expect, it } from 'vitest'
import { budgetStatus, goalPlan, monthsUntil, spentByCategory } from './calc'

describe('orçamento', () => {
  it('classifica o uso do limite', () => {
    expect(budgetStatus(400, 800)).toMatchObject({ pct: 50, state: 'ok', remaining: 400 })
    expect(budgetStatus(640, 800).state).toBe('warning')
    expect(budgetStatus(800, 800).state).toBe('warning')
    expect(budgetStatus(800.01, 800)).toMatchObject({ state: 'over', remaining: -0.01 })
  })

  it('soma só despesas, por categoria', () => {
    const totals = spentByCategory([
      { kind: 'expense', amount: 0.1, category_id: 'a' },
      { kind: 'expense', amount: 0.2, category_id: 'a' },
      { kind: 'income', amount: 1000, category_id: 'a' },
      { kind: 'transfer', amount: 50, category_id: null },
      { kind: 'expense', amount: 30, category_id: null },
    ])
    expect(totals.get('a')).toBe(0.3)
    expect(totals.get('')).toBe(30)
  })
})

describe('metas', () => {
  it('conta os meses até o prazo incluindo o atual', () => {
    expect(monthsUntil('2026-10-14', '2026-10-31')).toBe(1)
    expect(monthsUntil('2026-10-14', '2027-03-01')).toBe(6)
    expect(monthsUntil('2026-10-14', '2026-09-30')).toBe(0)
  })

  it('calcula quanto guardar por mês', () => {
    expect(goalPlan({ target: 6000, saved: 1500, targetDate: '2027-03-15' }, '2026-10-14')).toEqual({
      remaining: 4500,
      pct: 25,
      done: false,
      months: 6,
      perMonth: 750,
      late: false,
    })
    // Arredonda para cima no centavo.
    expect(goalPlan({ target: 100, saved: 0, targetDate: '2026-12-01' }, '2026-10-14').perMonth).toBe(33.34)
  })

  it('identifica meta concluída, sem prazo e atrasada', () => {
    expect(goalPlan({ target: 100, saved: 120, targetDate: '2026-12-01' }, '2026-10-14')).toMatchObject({ done: true, pct: 100, remaining: 0 })
    expect(goalPlan({ target: 100, saved: 10, targetDate: null }, '2026-10-14')).toMatchObject({ perMonth: null, late: false })
    expect(goalPlan({ target: 100, saved: 10, targetDate: '2026-09-01' }, '2026-10-14')).toMatchObject({ late: true, perMonth: null })
  })
})
