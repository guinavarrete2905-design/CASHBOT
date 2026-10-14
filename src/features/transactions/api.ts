import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { monthRange, shiftMonth, todayISO, type YearMonth } from '@/lib/dates'
import type { TransactionKind, TransactionStatus } from './summary'

export type { TransactionKind, TransactionStatus } from './summary'
export { statusLabel, summarize } from './summary'

export type Transaction = Omit<Tables<'transactions'>, 'kind' | 'status' | 'amount'> & {
  kind: TransactionKind
  status: TransactionStatus
  amount: number
}

export type TransactionInput = {
  kind: TransactionKind
  description: string
  amount: number
  occurredOn: string
  categoryId: string | null
  accountId: string | null
  /** Conta de destino (somente transferências). */
  transferAccountId: string | null
  status: TransactionStatus
  notes: string
}

const transactionsRoot = (spaceId: string) => ['transactions', spaceId] as const

function toKind(kind: string): TransactionKind {
  return kind === 'income' || kind === 'transfer' ? kind : 'expense'
}

function normalize(row: Tables<'transactions'>): Transaction {
  return {
    ...row,
    kind: toKind(row.kind),
    status: row.status === 'pending' ? 'pending' : 'paid',
    amount: Number(row.amount),
  }
}

/** Movimentações do mês, mais recentes primeiro. */
export function useMonthTransactions(spaceId: string | undefined, month: YearMonth) {
  return useQuery({
    queryKey: [...transactionsRoot(spaceId ?? 'none'), 'month', month],
    enabled: Boolean(spaceId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { start, endExclusive } = monthRange(month)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('space_id', spaceId!)
        .gte('occurred_on', start)
        .lt('occurred_on', endExclusive)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      return (data ?? []).map(normalize)
    },
  })
}

/** Últimas movimentações lançadas até hoje. */
export function useRecentTransactions(spaceId: string | undefined, limit = 6) {
  return useQuery({
    queryKey: [...transactionsRoot(spaceId ?? 'none'), 'recent', limit],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('space_id', spaceId!)
        .lte('occurred_on', todayISO())
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []).map(normalize)
    },
  })
}

/** Pendências (a pagar/receber) a partir de hoje, incluindo atrasadas. */
export function usePendingTransactions(spaceId: string | undefined, limit = 6) {
  return useQuery({
    queryKey: [...transactionsRoot(spaceId ?? 'none'), 'pending', limit],
    enabled: Boolean(spaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('space_id', spaceId!)
        .eq('status', 'pending')
        .order('occurred_on', { ascending: true })
        .limit(limit)
      if (error) throw error
      return (data ?? []).map(normalize)
    },
  })
}

export type MonthTotals = { month: YearMonth; income: number; expense: number }

/** Totais de receitas e despesas dos últimos `months` meses (inclui o mês atual). */
export function useMonthlyTotals(spaceId: string | undefined, months = 6, until: YearMonth) {
  return useQuery({
    queryKey: [...transactionsRoot(spaceId ?? 'none'), 'totals', months, until],
    enabled: Boolean(spaceId),
    queryFn: async (): Promise<MonthTotals[]> => {
      const first = shiftMonth(until, -(months - 1))
      const { data, error } = await supabase
        .from('transactions')
        .select('kind, amount, occurred_on')
        .eq('space_id', spaceId!)
        .gte('occurred_on', monthRange(first).start)
        .lt('occurred_on', monthRange(until).endExclusive)
        .limit(10000)
      if (error) throw error
      const buckets = new Map<string, MonthTotals>()
      for (let i = 0; i < months; i++) {
        const m = shiftMonth(first, i)
        buckets.set(m, { month: m, income: 0, expense: 0 })
      }
      for (const row of data ?? []) {
        const bucket = buckets.get(row.occurred_on.slice(0, 7))
        if (!bucket) continue
        if (row.kind === 'income') bucket.income += Number(row.amount)
        else if (row.kind === 'expense') bucket.expense += Number(row.amount)
      }
      return [...buckets.values()]
    },
  })
}

function toRow(input: TransactionInput) {
  return {
    kind: input.kind,
    description: input.description.trim(),
    amount: input.amount,
    occurred_on: input.occurredOn,
    category_id: input.kind === 'transfer' ? null : input.categoryId,
    account_id: input.accountId,
    transfer_account_id: input.kind === 'transfer' ? input.transferAccountId : null,
    status: input.status,
    notes: input.notes.trim() || null,
  }
}

function useInvalidate(spaceId: string) {
  const queryClient = useQueryClient()
  // Saldos de contas e faturas dependem das movimentações.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: transactionsRoot(spaceId) }),
      queryClient.invalidateQueries({ queryKey: ['accounts', spaceId] }),
    ])
}

export function useCreateTransaction(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const { error } = await supabase.from('transactions').insert({ space_id: spaceId, ...toRow(input) })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateTransaction(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async ({ id, ...input }: TransactionInput & { id: string }) => {
      const { data, error } = await supabase.from('transactions').update(toRow(input)).eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Você não tem permissão para editar esta movimentação.')
    },
    onSuccess: invalidate,
  })
}

/** Marca uma pendência como paga/recebida. */
export function useSetTransactionStatus(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TransactionStatus }) => {
      const { data, error } = await supabase.from('transactions').update({ status }).eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Você não tem permissão para editar esta movimentação.')
    },
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('transactions').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Só quem lançou, o proprietário ou um administrador pode excluir esta movimentação.')
      }
    },
    onSuccess: invalidate,
  })
}
