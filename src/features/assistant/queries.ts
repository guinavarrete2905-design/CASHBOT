import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/dates'
import { accountsKey, fetchAccounts, fetchCardMovements } from '@/features/accounts/api'
import { categoriesKey, fetchCategories } from '@/features/categories/api'
import { fetchBudgets, fetchGoals, planningKey } from '@/features/planning/api'
import { fetchAssets, fetchLiabilities, fetchSnapshots, wealthKey } from '@/features/wealth/api'
import { fetchPendingUntil } from '@/features/transactions/api'
import type { DataSource, TxKind } from './types'

/*
  Motor de consultas: implementação real da DataSource.
  - Usa o cliente Supabase com a sessão do usuário (chave pública): o RLS decide o que pode ser lido.
  - Só chama consultas fixas (tabelas e funções conhecidas). Nenhum texto do usuário vira SQL.
  - Reaproveita as mesmas funções de busca das telas e o mesmo cache (TanStack Query).
    As consultas do assistente ficam sob a chave ['transactions', espaço, ...], então são invalidadas
    automaticamente quando uma movimentação é criada, editada ou excluída.
*/

const SHORT = 15_000

function toKind(k: string): TxKind {
  return k === 'income' || k === 'transfer' ? k : 'expense'
}

export function createSupabaseDataSource(space: { id: string; name: string; type: string }, qc: QueryClient): DataSource {
  const spaceId = space.id
  const txKey = (...parts: unknown[]) => ['transactions', spaceId, 'assistant', ...parts]
  const fetch = <T,>(queryKey: readonly unknown[], queryFn: () => Promise<T>) => qc.fetchQuery({ queryKey, queryFn, staleTime: SHORT })

  const categories = () =>
    fetch(categoriesKey(spaceId), () => fetchCategories(spaceId)).then((rows) => rows.map((c) => ({ id: c.id, name: c.name, kind: c.kind, archived: c.archived })))
  const accounts = () =>
    fetch([...accountsKey(spaceId), 'list'], () => fetchAccounts(spaceId)).then((rows) =>
      rows.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
        archived: a.archived,
        creditLimit: a.creditLimit,
        closingDay: a.closing_day,
        dueDay: a.due_day,
      })),
    )

  return {
    today: todayISO(),
    space,
    newId: () => crypto.randomUUID(),
    categories,
    accounts,

    periodSummary: ({ from, to, accountId, categoryId }) =>
      fetch(txKey('summary', from, to, accountId ?? null, categoryId ?? null), async () => {
        const { data, error } = await supabase.rpc('assistant_period_summary', {
          p_space_id: spaceId,
          p_from: from,
          p_to: to,
          ...(accountId ? { p_account_id: accountId } : {}),
          ...(categoryId ? { p_category_id: categoryId } : {}),
        })
        if (error) throw error
        const r = data?.[0]
        return {
          income: Number(r?.income ?? 0),
          expense: Number(r?.expense ?? 0),
          pendingIncome: Number(r?.pending_income ?? 0),
          pendingExpense: Number(r?.pending_expense ?? 0),
          incomeCount: Number(r?.income_count ?? 0),
          expenseCount: Number(r?.expense_count ?? 0),
        }
      }),

    expensesByCategory: (from, to) =>
      fetch(txKey('by-category', from, to), async () => {
        const { data, error } = await supabase.rpc('assistant_expenses_by_category', { p_space_id: spaceId, p_from: from, p_to: to })
        if (error) throw error
        return (data ?? []).map((r) => ({ categoryId: r.category_id, name: r.category_name, total: Number(r.total), count: Number(r.tx_count) }))
      }),

    topExpenses: (from, to, limit, categoryId) =>
      fetch(txKey('top', from, to, limit, categoryId ?? null), async () => {
        const { data, error } = await supabase.rpc('assistant_top_expenses', {
          p_space_id: spaceId,
          p_from: from,
          p_to: to,
          p_limit: limit,
          ...(categoryId ? { p_category_id: categoryId } : {}),
        })
        if (error) throw error
        return (data ?? []).map((r) => ({
          id: r.id,
          description: r.description,
          amount: Number(r.amount),
          occurredOn: r.occurred_on,
          status: r.status === 'pending' ? ('pending' as const) : ('paid' as const),
          categoryName: r.category_name,
          accountName: r.account_name,
        }))
      }),

    monthlyTotals: (from, to) =>
      fetch(txKey('monthly', from, to), async () => {
        const { data, error } = await supabase.rpc('assistant_monthly_totals', { p_space_id: spaceId, p_from: from, p_to: to })
        if (error) throw error
        return (data ?? []).map((r) => ({ month: r.month, income: Number(r.income), expense: Number(r.expense) }))
      }),

    pendingUntil: (until) =>
      fetch(txKey('pending', until), async () =>
        (await fetchPendingUntil(spaceId, until, 200)).map((t) => ({
          id: t.id,
          kind: t.kind,
          description: t.description,
          amount: t.amount,
          occurredOn: t.occurred_on,
          accountId: t.account_id,
        })),
      ),

    cardMovements: (cardIds, fromISO) =>
      fetch([...accountsKey(spaceId), 'card-movements', cardIds.join(','), fromISO], () => fetchCardMovements(spaceId, cardIds, fromISO)),

    recent: (limit) =>
      fetch(txKey('recent', limit), async () => {
        const [{ data, error }, cats, accs] = await Promise.all([
          supabase
            .from('transactions')
            .select('id, kind, description, amount, occurred_on, status, category_id, account_id')
            .eq('space_id', spaceId)
            .lte('occurred_on', todayISO())
            .order('occurred_on', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 20)),
          categories(),
          accounts(),
        ])
        if (error) throw error
        return (data ?? []).map((r) => ({
          id: r.id,
          description: toKind(r.kind) === 'transfer' ? `${r.description} (transferência)` : r.description,
          amount: Number(r.amount),
          occurredOn: r.occurred_on,
          status: r.status === 'pending' ? ('pending' as const) : ('paid' as const),
          categoryName: cats.find((c) => c.id === r.category_id)?.name ?? null,
          accountName: accs.find((a) => a.id === r.account_id)?.name ?? null,
        }))
      }),

    budgets: () => fetch([...planningKey(spaceId), 'budgets'], () => fetchBudgets(spaceId)),
    goals: () => fetch([...planningKey(spaceId), 'goals'], () => fetchGoals(spaceId)),
    assets: () => fetch([...wealthKey(spaceId), 'assets'], () => fetchAssets(spaceId)),
    liabilities: () => fetch([...wealthKey(spaceId), 'liabilities'], () => fetchLiabilities(spaceId)),
    snapshots: () => fetch([...wealthKey(spaceId), 'snapshots'], () => fetchSnapshots(spaceId)),
  }
}
