export type TransactionKind = 'income' | 'expense' | 'transfer'
export type TransactionStatus = 'paid' | 'pending'

/** Rótulo do status conforme o tipo: receita "Recebida"/"A receber", despesa "Paga"/"A pagar". */
export function statusLabel(kind: TransactionKind, status: TransactionStatus): string {
  if (kind === 'transfer') return status === 'pending' ? 'Agendada' : 'Feita'
  if (status === 'pending') return kind === 'income' ? 'A receber' : 'A pagar'
  return kind === 'income' ? 'Recebida' : 'Paga'
}

type Summable = { kind: TransactionKind; status: TransactionStatus; amount: number }

function toCents(n: number) {
  return Math.round(n * 100)
}

/**
 * Totais de receitas e despesas, em centavos internamente para não acumular erro de ponto flutuante.
 * Transferências entre contas não são receita nem despesa e ficam de fora.
 */
export function summarize(transactions: Summable[]) {
  let income = 0
  let expense = 0
  let pendingIncome = 0
  let pendingExpense = 0
  for (const t of transactions) {
    if (t.kind === 'transfer') continue
    const cents = toCents(t.amount)
    if (t.kind === 'income') {
      income += cents
      if (t.status === 'pending') pendingIncome += cents
    } else {
      expense += cents
      if (t.status === 'pending') pendingExpense += cents
    }
  }
  return {
    income: income / 100,
    expense: expense / 100,
    balance: (income - expense) / 100,
    pendingIncome: pendingIncome / 100,
    pendingExpense: pendingExpense / 100,
  }
}

/** Agrupa por dia mantendo a ordem recebida (mais recentes primeiro). */
export function groupByDay<T extends { occurred_on: string }>(items: T[]): Array<{ day: string; items: T[] }> {
  const groups: Array<{ day: string; items: T[] }> = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.day === item.occurred_on) last.items.push(item)
    else groups.push({ day: item.occurred_on, items: [item] })
  }
  return groups
}
