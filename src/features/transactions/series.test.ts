import { describe, expect, it } from 'vitest'
import { addMonthsKeepingDay, buildSeries, seriesLabel, splitAmount } from './series'

describe('séries', () => {
  it('mantém o dia do mês e ajusta no fim do mês', () => {
    expect(addMonthsKeepingDay('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsKeepingDay('2026-01-31', 2)).toBe('2026-03-31')
    expect(addMonthsKeepingDay('2027-12-15', 1)).toBe('2028-01-15')
    expect(addMonthsKeepingDay('2028-01-30', 1)).toBe('2028-02-29')
  })

  it('divide o total sem perder centavos', () => {
    expect(splitAmount(100, 3)).toEqual([33.34, 33.33, 33.33])
    expect(splitAmount(1200, 12)).toEqual(Array(12).fill(100))
    const parts = splitAmount(999.99, 7)
    expect(Math.round(parts.reduce((s, v) => s + v, 0) * 100)).toBe(99999)
  })

  it('gera parcelas com valores divididos e futuras pendentes', () => {
    const items = buildSeries({ kind: 'installment', amount: 300, count: 3, start: '2026-10-10', status: 'paid', today: '2026-10-14' })
    expect(items).toEqual([
      { index: 1, occurredOn: '2026-10-10', amount: 100, status: 'paid' },
      { index: 2, occurredOn: '2026-11-10', amount: 100, status: 'pending' },
      { index: 3, occurredOn: '2026-12-10', amount: 100, status: 'pending' },
    ])
  })

  it('no cartão, todas as parcelas entram como pagas (vão para as faturas)', () => {
    const items = buildSeries({
      kind: 'installment',
      amount: 200,
      count: 2,
      start: '2026-10-10',
      status: 'paid',
      futurePending: false,
      today: '2026-10-14',
    })
    expect(items.map((i) => i.status)).toEqual(['paid', 'paid'])
  })

  it('repete o valor cheio em lançamentos mensais', () => {
    const items = buildSeries({ kind: 'recurring', amount: 1500, count: 2, start: '2026-10-05', status: 'pending', today: '2026-10-14' })
    expect(items.map((i) => [i.amount, i.status])).toEqual([
      [1500, 'pending'],
      [1500, 'pending'],
    ])
  })

  it('descreve a posição', () => {
    expect(seriesLabel('installment', 3, 10)).toBe('3/10')
    expect(seriesLabel('recurring', 2, 12)).toBe('mensal 2/12')
    expect(seriesLabel(null, null, null)).toBeNull()
  })
})
