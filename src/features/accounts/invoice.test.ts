import { describe, expect, it } from 'vitest'
import { currentInvoices, dayInMonth, invoiceMonthFor, invoicePeriod, invoiceTotal } from './invoice'

describe('fatura de cartão', () => {
  it('limita o dia ao fim do mês', () => {
    expect(dayInMonth('2026-02', 31)).toBe('2026-02-28')
    expect(dayInMonth('2028-02', 30)).toBe('2028-02-29')
    expect(dayInMonth('2026-10', 5)).toBe('2026-10-05')
  })

  it('coloca a compra na fatura certa conforme o fechamento', () => {
    expect(invoiceMonthFor('2026-10-05', 5)).toBe('2026-10')
    expect(invoiceMonthFor('2026-10-06', 5)).toBe('2026-11')
    expect(invoiceMonthFor('2026-12-20', 10)).toBe('2027-01')
    expect(invoiceMonthFor('2026-02-28', 31)).toBe('2026-02')
  })

  it('calcula período e vencimento', () => {
    // Fecha dia 5, vence dia 12 do mesmo mês.
    expect(invoicePeriod('2026-10', 5, 12)).toEqual({
      month: '2026-10',
      start: '2026-09-06',
      closing: '2026-10-05',
      due: '2026-10-12',
    })
    // Fecha dia 28, vence dia 5 do mês seguinte.
    expect(invoicePeriod('2026-12', 28, 5)).toEqual({
      month: '2026-12',
      start: '2026-11-29',
      closing: '2026-12-28',
      due: '2027-01-05',
    })
    // Fechamento no dia 31 em março começa logo após o fim de fevereiro.
    expect(invoicePeriod('2026-03', 31, 10).start).toBe('2026-03-01')
  })

  it('identifica a fatura aberta e a última fechada', () => {
    const { open, closed } = currentInvoices(5, 12, '2026-10-14')
    expect(open.month).toBe('2026-11')
    expect(closed.month).toBe('2026-10')
    expect(closed.due).toBe('2026-10-12')
  })

  it('soma compras e desconta estornos, sem contar pagamentos', () => {
    const period = invoicePeriod('2026-10', 5, 12)
    const total = invoiceTotal(
      [
        { kind: 'expense', amount: 100.1, occurred_on: '2026-09-06', account_id: 'card' },
        { kind: 'expense', amount: 0.2, occurred_on: '2026-10-05', account_id: 'card' },
        { kind: 'income', amount: 30, occurred_on: '2026-09-20', account_id: 'card' },
        { kind: 'expense', amount: 999, occurred_on: '2026-10-06', account_id: 'card' },
        { kind: 'expense', amount: 999, occurred_on: '2026-09-10', account_id: 'other' },
        { kind: 'transfer', amount: 500, occurred_on: '2026-09-30', account_id: 'card' },
      ],
      'card',
      period,
    )
    expect(total).toBe(70.3)
  })
})
