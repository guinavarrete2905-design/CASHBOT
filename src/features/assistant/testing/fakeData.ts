import type { DataSource, ExpenseItem, PendingItem } from '../types'

/*
  Fonte de dados falsa, usada SOMENTE nos testes automatizados e no relatório de cobertura.
  Nunca é usada pelo aplicativo: no app, o assistente só lê dados reais do Supabase.
*/

type Tx = {
  id: string
  kind: 'income' | 'expense' | 'transfer'
  description: string
  amount: number
  occurredOn: string
  categoryId: string | null
  accountId: string | null
  status: 'paid' | 'pending'
}

export const TEST_TODAY = '2026-10-14'

export const testCategories = [
  { id: 'food', name: 'Alimentação', kind: 'expense' as const, archived: false },
  { id: 'home', name: 'Moradia', kind: 'expense' as const, archived: false },
  { id: 'transp', name: 'Transporte', kind: 'expense' as const, archived: false },
  { id: 'health', name: 'Saúde', kind: 'expense' as const, archived: false },
  { id: 'fun', name: 'Lazer', kind: 'expense' as const, archived: false },
  { id: 'shop', name: 'Compras', kind: 'expense' as const, archived: false },
  { id: 'bills', name: 'Contas e serviços', kind: 'expense' as const, archived: false },
  { id: 'salary', name: 'Salário', kind: 'income' as const, archived: false },
  { id: 'other-in', name: 'Outras receitas', kind: 'income' as const, archived: false },
]

export const testAccounts = [
  { id: 'itau', name: 'Itaú', type: 'checking', balance: 3200, archived: false, creditLimit: null, closingDay: null, dueDay: null },
  { id: 'cash', name: 'Carteira', type: 'wallet', balance: 150, archived: false, creditLimit: null, closingDay: null, dueDay: null },
  { id: 'nu', name: 'Nubank', type: 'credit_card', balance: -850, archived: false, creditLimit: 5000, closingDay: 3, dueDay: 10 },
]

export const testTransactions: Tx[] = [
  { id: 't1', kind: 'income', description: 'Salário', amount: 5000, occurredOn: '2026-09-05', categoryId: 'salary', accountId: 'itau', status: 'paid' },
  { id: 't2', kind: 'expense', description: 'Aluguel', amount: 1500, occurredOn: '2026-09-10', categoryId: 'home', accountId: 'itau', status: 'paid' },
  { id: 't3', kind: 'expense', description: 'Mercado', amount: 600, occurredOn: '2026-09-12', categoryId: 'food', accountId: 'nu', status: 'paid' },
  { id: 't4', kind: 'expense', description: 'Gasolina', amount: 250, occurredOn: '2026-09-20', categoryId: 'transp', accountId: 'nu', status: 'paid' },
  { id: 't5', kind: 'income', description: 'Salário', amount: 5000, occurredOn: '2026-10-05', categoryId: 'salary', accountId: 'itau', status: 'paid' },
  { id: 't6', kind: 'expense', description: 'Aluguel', amount: 1500, occurredOn: '2026-10-10', categoryId: 'home', accountId: 'itau', status: 'paid' },
  { id: 't7', kind: 'expense', description: 'Supermercado', amount: 800, occurredOn: '2026-10-06', categoryId: 'food', accountId: 'nu', status: 'paid' },
  { id: 't8', kind: 'expense', description: 'Restaurante', amount: 200, occurredOn: '2026-10-11', categoryId: 'food', accountId: 'nu', status: 'paid' },
  { id: 't9', kind: 'expense', description: 'Cinema', amount: 100, occurredOn: '2026-10-12', categoryId: 'fun', accountId: 'cash', status: 'paid' },
  { id: 't10', kind: 'expense', description: 'Conta de luz', amount: 180, occurredOn: '2026-10-20', categoryId: 'bills', accountId: 'itau', status: 'pending' },
  { id: 't11', kind: 'expense', description: 'Internet', amount: 120, occurredOn: '2026-10-08', categoryId: 'bills', accountId: 'itau', status: 'pending' },
  { id: 't12', kind: 'income', description: 'Freela', amount: 900, occurredOn: '2026-10-25', categoryId: 'other-in', accountId: 'itau', status: 'pending' },
  { id: 't13', kind: 'transfer', description: 'Transferência', amount: 300, occurredOn: '2026-10-07', categoryId: null, accountId: 'itau', status: 'paid' },
  { id: 't14', kind: 'expense', description: 'Farmácia', amount: 90, occurredOn: '2026-08-15', categoryId: 'health', accountId: 'itau', status: 'paid' },
  { id: 't15', kind: 'income', description: 'Salário', amount: 4800, occurredOn: '2026-08-05', categoryId: 'salary', accountId: 'itau', status: 'paid' },
]

const cents = (n: number) => Math.round(n * 100)

export function createFakeDataSource(overrides: Partial<{ transactions: Tx[]; empty: boolean }> = {}): DataSource {
  const txs = overrides.empty ? [] : overrides.transactions ?? testTransactions
  const accounts = overrides.empty ? [] : testAccounts
  let seq = 0
  const inRange = (t: Tx, from: string, to: string) => t.occurredOn >= from && t.occurredOn <= to
  const catName = (id: string | null) => testCategories.find((c) => c.id === id)?.name ?? null
  const accName = (id: string | null) => testAccounts.find((a) => a.id === id)?.name ?? null
  const asItem = (t: Tx): ExpenseItem => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    occurredOn: t.occurredOn,
    status: t.status,
    categoryName: catName(t.categoryId),
    accountName: accName(t.accountId),
  })
  return {
    today: TEST_TODAY,
    space: { id: 'space-1', name: 'Pessoal', type: 'personal' },
    newId: () => `draft-${++seq}`,
    categories: async () => testCategories,
    accounts: async () => accounts,
    periodSummary: async ({ from, to, accountId, categoryId }) => {
      const rows = txs.filter((t) => inRange(t, from, to) && t.kind !== 'transfer' && (!accountId || t.accountId === accountId) && (!categoryId || t.categoryId === categoryId))
      const sum = (f: (t: Tx) => boolean) => rows.filter(f).reduce((s, t) => s + cents(t.amount), 0) / 100
      return {
        income: sum((t) => t.kind === 'income'),
        expense: sum((t) => t.kind === 'expense'),
        pendingIncome: sum((t) => t.kind === 'income' && t.status === 'pending'),
        pendingExpense: sum((t) => t.kind === 'expense' && t.status === 'pending'),
        incomeCount: rows.filter((t) => t.kind === 'income').length,
        expenseCount: rows.filter((t) => t.kind === 'expense').length,
      }
    },
    expensesByCategory: async (from, to) => {
      const map = new Map<string, { categoryId: string | null; name: string | null; total: number; count: number }>()
      for (const t of txs.filter((x) => x.kind === 'expense' && inRange(x, from, to))) {
        const key = t.categoryId ?? ''
        const row = map.get(key) ?? { categoryId: t.categoryId, name: catName(t.categoryId), total: 0, count: 0 }
        row.total = (cents(row.total) + cents(t.amount)) / 100
        row.count++
        map.set(key, row)
      }
      return [...map.values()].sort((a, b) => b.total - a.total)
    },
    topExpenses: async (from, to, limit, categoryId) =>
      txs
        .filter((t) => t.kind === 'expense' && inRange(t, from, to) && (!categoryId || t.categoryId === categoryId))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit)
        .map(asItem),
    monthlyTotals: async (from, to) => {
      const map = new Map<string, { month: string; income: number; expense: number }>()
      for (const t of txs.filter((x) => inRange(x, from, to) && x.kind !== 'transfer')) {
        const m = `${t.occurredOn.slice(0, 7)}-01`
        const row = map.get(m) ?? { month: m, income: 0, expense: 0 }
        if (t.kind === 'income') row.income += t.amount
        else row.expense += t.amount
        map.set(m, row)
      }
      return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
    },
    pendingUntil: async (until) =>
      txs
        .filter((t) => t.status === 'pending' && t.occurredOn <= until)
        .map((t): PendingItem => ({ id: t.id, kind: t.kind, description: t.description, amount: t.amount, occurredOn: t.occurredOn, accountId: t.accountId })),
    cardMovements: async (cardIds, fromISO) =>
      txs
        .filter((t) => t.accountId && cardIds.includes(t.accountId) && t.occurredOn >= fromISO)
        .map((t) => ({ kind: t.kind, amount: t.amount, occurred_on: t.occurredOn, account_id: t.accountId })),
    recent: async (limit) => txs.filter((t) => t.occurredOn <= TEST_TODAY).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)).slice(0, limit).map(asItem),
    budgets: async () => (overrides.empty ? [] : [{ categoryId: 'food', amount: 900 }, { categoryId: 'fun', amount: 300 }]),
    goals: async () => (overrides.empty ? [] : [{ id: 'g1', name: 'Viagem', target: 6000, saved: 1500, targetDate: '2027-03-31', archived: false }]),
    assets: async () => (overrides.empty ? [] : [{ name: 'Carro', type: 'vehicle', value: 40000, archived: false }]),
    liabilities: async () => (overrides.empty ? [] : [{ name: 'Financiamento do carro', type: 'financing', balance: 18000, monthlyPayment: 900, archived: false }]),
    snapshots: async () =>
      overrides.empty
        ? []
        : [
            { month: '2026-08', netWorth: 23000, accounts: 2800, assets: 40000, liabilities: 19800 },
            { month: '2026-09', netWorth: 23800, accounts: 3100, assets: 40000, liabilities: 19300 },
            { month: '2026-10', netWorth: 24500, accounts: 3350, assets: 40000, liabilities: 18850 },
          ],
  }
}
