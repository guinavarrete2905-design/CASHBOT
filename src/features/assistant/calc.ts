/*
  Motor de cálculos do Assistente Financeiro. Funções puras e determinísticas.
  Taxas sempre em percentual por período (ex.: 1 = 1% ao mês) e prazos no mesmo período da taxa.
*/

const round2 = (n: number) => Math.round(n * 100) / 100
const cents = (n: number) => Math.round(n * 100)

export function simpleInterest(principal: number, ratePct: number, periods: number) {
  const interest = round2(principal * (ratePct / 100) * periods)
  return { interest, total: round2(principal + interest) }
}

export function compoundInterest(principal: number, ratePct: number, periods: number, monthlyDeposit = 0) {
  const r = ratePct / 100
  const growth = (1 + r) ** periods
  const fromPrincipal = principal * growth
  // Aportes no fim de cada período.
  const fromDeposits = r === 0 ? monthlyDeposit * periods : monthlyDeposit * ((growth - 1) / r)
  const total = round2(fromPrincipal + fromDeposits)
  const invested = round2(principal + monthlyDeposit * periods)
  return { total, invested, interest: round2(total - invested) }
}

/** Parcela fixa (tabela Price). */
export function priceInstallment(principal: number, ratePct: number, periods: number) {
  const r = ratePct / 100
  const payment = r === 0 ? principal / periods : (principal * r) / (1 - (1 + r) ** -periods)
  const p = round2(payment)
  return { payment: p, total: round2(p * periods), interest: round2(p * periods - principal) }
}

/** Quanto guardar por período para chegar ao alvo (sem rendimento quando a taxa é 0). */
export function savingPerPeriod(target: number, periods: number, ratePct = 0) {
  if (periods <= 0) return null
  const r = ratePct / 100
  const payment = r === 0 ? target / periods : (target * r) / ((1 + r) ** periods - 1)
  // Arredonda para cima no centavo, para não faltar no fim.
  return Math.ceil(payment * 100 - 1e-9) / 100
}

/** Quantos períodos guardando `deposit` para chegar ao alvo, partindo de `start`. */
export function periodsToReach(target: number, deposit: number, start = 0, ratePct = 0): number | null {
  if (target <= start) return 0
  if (deposit <= 0 && ratePct <= 0) return null
  const r = ratePct / 100
  if (r === 0) return Math.ceil((cents(target) - cents(start)) / cents(deposit))
  let balance = start
  for (let n = 1; n <= 1200; n++) {
    balance = balance * (1 + r) + deposit
    if (balance >= target - 0.005) return n
  }
  return null
}

export function percentOf(pct: number, value: number) {
  return round2((pct / 100) * value)
}

/** Variação percentual de `from` para `to`; null quando a base é zero. */
export function variationPct(from: number, to: number): number | null {
  if (from === 0) return null
  return ((to - from) / Math.abs(from)) * 100
}

export function sharePct(part: number, total: number): number | null {
  if (total <= 0) return null
  return (part / total) * 100
}

export function sumCents(values: number[]) {
  return values.reduce((s, v) => s + cents(v), 0) / 100
}

export function formatPct(value: number, digits = 1): string {
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value)}%`
}

/** "12 meses" → "1 ano"; "30 meses" → "2 anos e 6 meses". */
export function formatMonths(n: number): string {
  if (n < 12) return `${n} ${n === 1 ? 'mês' : 'meses'}`
  const y = Math.floor(n / 12)
  const m = n % 12
  const years = `${y} ${y === 1 ? 'ano' : 'anos'}`
  return m ? `${years} e ${m} ${m === 1 ? 'mês' : 'meses'}` : years
}
