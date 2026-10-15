const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string) {
  let f = formatters.get(currency)
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    formatters.set(currency, f)
  }
  return f
}

/** Formata um valor em moeda no padrão brasileiro: 1234.5 → "R$ 1.234,50". */
export function formatMoney(value: number, currency = 'BRL'): string {
  return formatter(currency).format(value)
}

/** Valor para preencher o campo de edição: 1234.5 → "1.234,50". */
export function formatMoneyInput(value: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

/**
 * Lê o valor digitado. Aceita "1.234,56", "1234,5", "1234.56", "R$ 12" e "1.234".
 * Devolve null quando não é um número válido. Arredonda para centavos.
 */
export function parseMoneyInput(raw: string): number | null {
  let s = raw.replace(/[R$\s\u00A0]/g, '').replace(/[A-Za-z€]/g, '')
  if (!s) return null
  if (s.startsWith('-')) return null

  if (s.includes(',')) {
    // Padrão brasileiro: ponto = milhar, vírgula = decimal.
    if ((s.match(/,/g) ?? []).length > 1) return null
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    const dots = (s.match(/\./g) ?? []).length
    if (dots > 1) {
      s = s.replace(/\./g, '')
    } else if (dots === 1) {
      // "1.234" (3 dígitos depois do ponto) é milhar; "12.5" é decimal.
      const [, decimals = ''] = s.split('.')
      if (decimals.length === 3) s = s.replace('.', '')
    }
  }

  const match = s.match(/^(\d+)(?:\.(\d+))?$/)
  if (!match) return null
  // Arredonda pelos dígitos (evita erro de ponto flutuante, ex.: 10,005 → 10,01).
  const [, intPart, decPart = ''] = match
  const firstThree = (decPart + '000').slice(0, 3)
  const cents = Number(intPart) * 100 + Math.round(Number(firstThree) / 10)
  const value = cents / 100
  return Number.isFinite(value) ? value : null
}
