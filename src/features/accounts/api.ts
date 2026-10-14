import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { toKindSafe } from './kinds'

export type AccountType = 'checking' | 'savings' | 'wallet' | 'investment' | 'credit_card'

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  wallet: 'Dinheiro',
  investment: 'Investimento',
  credit_card: 'Cartão de crédito',
}

export type Account = Omit<Tables<'accounts'>, 'type' | 'initial_balance' | 'credit_limit'> & {
  type: AccountType
  initialBalance: number
  creditLimit: number | null
  /** Saldo considerando só o que já foi pago/recebido. Em cartões é negativo (valor em aberto). */
  balance: number
}

export type CardMovement = {
  kind: 'income' | 'expense' | 'transfer'
  amount: number
  occurred_on: string
  account_id: string | null
}

export const accountsKey = (spaceId: string) => ['accounts', spaceId] as const

function isAccountType(value: string): value is AccountType {
  return value in ACCOUNT_TYPE_LABEL
}

export function isCard(account: Pick<Account, 'type'>) {
  return account.type === 'credit_card'
}

/** Contas e cartões do espaço com o saldo de cada um. */
export function useAccounts(spaceId: string | undefined) {
  return useQuery({
    queryKey: [...accountsKey(spaceId ?? 'none'), 'list'],
    enabled: Boolean(spaceId),
    queryFn: async (): Promise<Account[]> => {
      const [accountsRes, balancesRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('space_id', spaceId!),
        supabase.from('account_balances').select('account_id, balance').eq('space_id', spaceId!),
      ])
      if (accountsRes.error) throw accountsRes.error
      if (balancesRes.error) throw balancesRes.error

      const balances = new Map((balancesRes.data ?? []).map((b) => [b.account_id, Number(b.balance ?? 0)]))
      return (accountsRes.data ?? [])
        .filter((a) => isAccountType(a.type))
        .map((a) => ({
          ...a,
          type: a.type as AccountType,
          initialBalance: Number(a.initial_balance),
          creditLimit: a.credit_limit === null ? null : Number(a.credit_limit),
          balance: balances.get(a.id) ?? Number(a.initial_balance),
        }))
        .sort((a, b) => Number(isCard(a)) - Number(isCard(b)) || a.name.localeCompare(b.name, 'pt-BR'))
    },
  })
}

/** Movimentações lançadas nos cartões a partir de uma data (para calcular faturas). */
export function useCardMovements(spaceId: string | undefined, cardIds: string[], fromISO: string) {
  return useQuery({
    queryKey: [...accountsKey(spaceId ?? 'none'), 'card-movements', cardIds.join(','), fromISO],
    enabled: Boolean(spaceId) && cardIds.length > 0,
    queryFn: async (): Promise<CardMovement[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('kind, amount, occurred_on, account_id')
        .eq('space_id', spaceId!)
        .in('account_id', cardIds)
        .gte('occurred_on', fromISO)
        .limit(5000)
      if (error) throw error
      return (data ?? []).map((m) => ({ ...m, kind: toKindSafe(m.kind), amount: Number(m.amount) }))
    },
  })
}

export type AccountInput = {
  name: string
  type: AccountType
  initialBalance: number
  creditLimit: number | null
  closingDay: number | null
  dueDay: number | null
}

function toRow(input: AccountInput) {
  const card = input.type === 'credit_card'
  return {
    name: input.name.trim(),
    type: input.type,
    // Em cartões, o valor inicial é a dívida já existente (guardada como negativa).
    initial_balance: card ? -Math.abs(input.initialBalance) : input.initialBalance,
    credit_limit: card ? input.creditLimit : null,
    closing_day: card ? input.closingDay : null,
    due_day: card ? input.dueDay : null,
  }
}

function useInvalidate(spaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: accountsKey(spaceId) })
}

export function useCreateAccount(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (input: AccountInput) => {
      const { error } = await supabase.from('accounts').insert({ space_id: spaceId, ...toRow(input) })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateAccount(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async ({ id, ...input }: AccountInput & { id: string }) => {
      const { data, error } = await supabase.from('accounts').update(toRow(input)).eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Somente proprietário ou administrador do espaço podem editar contas.')
    },
    onSuccess: invalidate,
  })
}

export function useArchiveAccount(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { data, error } = await supabase.from('accounts').update({ archived }).eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Somente proprietário ou administrador do espaço podem alterar contas.')
    },
    onSuccess: invalidate,
  })
}

export function useDeleteAccount(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('accounts').delete().eq('id', id).select('id')
      if (error) {
        if (error.code === '23503') {
          throw new Error('Esta conta tem movimentações e não pode ser excluída. Arquive-a para escondê-la.')
        }
        throw error
      }
      if (!data || data.length === 0) throw new Error('Somente proprietário ou administrador do espaço podem excluir contas.')
    },
    onSuccess: invalidate,
  })
}
