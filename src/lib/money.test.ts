import { describe, expect, it } from 'vitest'
import { formatMoney, formatMoneyInput, parseMoneyInput } from './money'

const nbsp = (s: string) => s.replace(/ /g, ' ')

describe('parseMoneyInput', () => {
  it('entende o formato brasileiro', () => {
    expect(parseMoneyInput('1.234,56')).toBe(1234.56)
    expect(parseMoneyInput('1234,5')).toBe(1234.5)
    expect(parseMoneyInput('R$ 12')).toBe(12)
    expect(parseMoneyInput('0,99')).toBe(0.99)
    expect(parseMoneyInput('1.000.000,00')).toBe(1000000)
  })

  it('aceita ponto como decimal e trata "1.234" como milhar', () => {
    expect(parseMoneyInput('1234.56')).toBe(1234.56)
    expect(parseMoneyInput('12.5')).toBe(12.5)
    expect(parseMoneyInput('1.234')).toBe(1234)
  })

  it('arredonda para centavos', () => {
    expect(parseMoneyInput('10,005')).toBe(10.01)
  })

  it('recusa valores inválidos', () => {
    expect(parseMoneyInput('')).toBeNull()
    expect(parseMoneyInput('abc')).toBeNull()
    expect(parseMoneyInput('1,2,3')).toBeNull()
    expect(parseMoneyInput('-5')).toBeNull()
  })
})

describe('formatação', () => {
  it('formata em reais', () => {
    expect(nbsp(formatMoney(1234.5))).toBe('R$ 1.234,50')
    expect(formatMoneyInput(1234.5)).toBe('1.234,50')
  })
})
