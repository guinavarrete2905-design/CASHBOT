export type BudgetState = 'ok' | 'warning' | 'over'

const cents = (n: number) => Math.round(n * 100)

/** Situação de um orçamento: até 80% ok, de 80% a 100% atenção, acima de 100% estourado. */
export function budgetStatus(spent: number, limit: number) {
  const pct = limit > 0 ? (spent / limit) * 100 : 0
  const state: BudgetState = pct > 100 ? 'over' : pct >= 80 ? 'warning' : 'ok'
  return { pct, state, remaining: (cents(limit) - cents(spent)) / 100 }
}

/** Soma das despesas por categoria (chave '' para "sem categoria"). Inclui pendentes: é o previsto do mês. */
export function spentByCategory(items: Array<{ kind: string; amount: number; category_id: string | null }>) {
  const totals = new Map<string, number>()
  for (const t of items) {
    if (t.kind !== 'expense') continue
    const key = t.category_id ?? ''
    totals.set(key, (totals.get(key) ?? 0) + cents(t.amount))
  }
  return new Map([...totals].map(([k, v]) => [k, v / 100]))
}

/** Meses restantes até o mês do prazo, contando o mês atual. 0 se o prazo já passou. */
export function monthsUntil(todayISO: string, targetISO: string): number {
  const [ty, tm] = todayISO.split('-').map(Number)
  const [gy, gm] = targetISO.split('-').map(Number)
  const diff = gy * 12 + gm - (ty * 12 + tm) + 1
  return Math.max(0, diff)
}

export function goalPlan(goal: { target: number; saved: number; targetDate: string | null }, todayISO: string) {
  const remaining = Math.max(0, (cents(goal.target) - cents(goal.saved)) / 100)
  const pct = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0
  const done = remaining === 0
  if (!goal.targetDate || done) {
    return { remaining, pct, done, months: null, perMonth: null, late: false }
  }
  const months = monthsUntil(todayISO, goal.targetDate)
  const late = months === 0 || goal.targetDate < todayISO
  // Arredonda para cima no centavo, para não faltar no fim.
  const perMonth = late ? null : Math.ceil(cents(remaining) / months) / 100
  return { remaining, pct, done, months, perMonth, late }
}
