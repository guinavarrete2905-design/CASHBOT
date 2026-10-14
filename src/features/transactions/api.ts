import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { monthRange, shiftMonth, todayISO, type YearMonth } from '@/lib/dates'
import { buildSeries, type SeriesKind, type SeriesScope } from './series'
import type { TransactionKind, TransactionStatus } from './summary'

export type { TransactionKind, TransactionStatus } from './summary'
export { statusLabel, summarize } from './summary'
export type { SeriesKind, SeriesScope } from './series'

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
  /** Somente ao criar: gera parcelas ou ocorrências mensais. */
  series?: { kind: SeriesKind; count: number; futurePending: boolean }
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
        // Atrasadas e as dos próximos 30 dias.
        .lte('occurred_on', todayISO(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)))
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
      const base = { space_id: spaceId, ...toRow(input) }
      if (!input.series) {
        const { error } = await supabase.from('transactions').insert(base)
        if (error) throw error
        return 1
      }
      // Série: todas as parcelas/ocorrências num único insert (tudo ou nada).
      const seriesId = crypto.randomUUID()
      const items = buildSeries({
        kind: input.series.kind,
        amount: input.amount,
        count: input.series.count,
        start: input.occurredOn,
        status: input.status,
        futurePending: input.series.futurePending,
      })
      const rows = items.map((item) => ({
        ...base,
        amount: item.amount,
        occurred_on: item.occurredOn,
        status: item.status,
        series_id: seriesId,
        series_kind: input.series!.kind,
        series_index: item.index,
        series_total: input.series!.count,
      }))
      const { error } = await supabase.from('transactions').insert(rows)
      if (error) throw error
      return rows.length
    },
    onSuccess: invalidate,
  })
}

type UpdateArgs = TransactionInput & {
  id: string
  /** Para movimentações de uma série: até onde a mudança vale. */
  scope?: SeriesScope
  seriesId?: string | null
  seriesIndex?: number | null
}

export function useUpdateTransaction(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async ({ id, scope = 'this', seriesId, seriesIndex, ...input }: UpdateArgs) => {
      const row = toRow(input)
      if (seriesId && scope !== 'this') {
        // Nas outras da série muda tudo, menos a data e a situação de cada uma.
        const { occurred_on: _date, status: _status, ...shared } = row
        void _date
        void _status
        let query = supabase.from('transactions').update(shared).eq('series_id', seriesId).neq('id', id)
        if (scope === 'next' && seriesIndex) query = query.gt('series_index', seriesIndex)
        const { error: seriesError } = await query
        if (seriesError) throw seriesError
      }
      const { data, error } = await supabase.from('transactions').update(row).eq('id', id).select('id')
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

type DeleteArgs = { id: string; scope?: SeriesScope; seriesId?: string | null; seriesIndex?: number | null }

export function useDeleteTransaction(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async ({ id, scope = 'this', seriesId, seriesIndex }: DeleteArgs) => {
      let query = supabase.from('transactions').delete()
      if (seriesId && scope === 'all') query = query.eq('series_id', seriesId)
      else if (seriesId && scope === 'next' && seriesIndex) query = query.eq('series_id', seriesId).gte('series_index', seriesIndex)
      else query = query.eq('id', id)
      const { data, error } = await query.select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Só quem lançou, o proprietário ou um administrador pode excluir esta movimentação.')
      }
      return data.length
    },
    onSuccess: invalidate,
  })
}
