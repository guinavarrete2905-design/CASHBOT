import { describe, expect, it } from 'vitest'
import { formatDayHeading, formatMonth, isYearMonth, monthRange, shiftMonth, todayISO } from './dates'

describe('datas', () => {
  it('avança e volta meses atravessando o ano', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-10', -5)).toBe('2026-05')
  })

  it('calcula o intervalo do mês', () => {
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', endExclusive: '2026-03-01' })
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' })
  })

  it('valida o formato AAAA-MM', () => {
    expect(isYearMonth('2026-10')).toBe(true)
    expect(isYearMonth('2026-13')).toBe(false)
    expect(isYearMonth('out')).toBe(false)
  })

  it('usa a data local', () => {
    expect(todayISO(new Date(2026, 9, 14, 23, 30))).toBe('2026-10-14')
  })

  it('escreve meses e dias em português', () => {
    expect(formatMonth('2026-10')).toBe('Outubro de 2026')
    const now = new Date(2026, 9, 14, 12)
    expect(formatDayHeading('2026-10-14', now)).toBe('Hoje')
    expect(formatDayHeading('2026-10-13', now)).toBe('Ontem')
    expect(formatDayHeading('2026-10-10', now)).toMatch(/^Sábado, 10 de outubro$/)
  })
})
