import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/*
  Ações em massa sobre movimentações já gravadas. Cada ação é uma única chamada a uma função do banco
  que altera todas as selecionadas ou nenhuma (sem resultado parcial), respeitando o RLS.
*/

function useInvalidate(spaceId: string) {
  const queryClient = useQueryClient()
  // Mesmas chaves do formulário individual: listas, totais, saldos e faturas.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions', spaceId] }),
      queryClient.invalidateQueries({ queryKey: ['accounts', spaceId] }),
    ])
}

export function useDeleteTransactionsBatch(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (ids: string[]): Promise<number> => {
      const { data, error } = await supabase.rpc('delete_transactions_batch', { p_space_id: spaceId, p_ids: ids })
      if (error) throw error
      return Number(data ?? 0)
    },
    onSuccess: invalidate,
  })
}

export type BatchUpdate = { ids: string[]; account?: { id: string | null }; category?: { id: string | null } }

export function useUpdateTransactionsBatch(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async ({ ids, account, category }: BatchUpdate): Promise<number> => {
      const { data, error } = await supabase.rpc('update_transactions_batch', {
        p_space_id: spaceId,
        p_ids: ids,
        p_set_account: Boolean(account),
        p_account_id: account?.id ?? null,
        p_set_category: Boolean(category),
        p_category_id: category?.id ?? null,
      })
      if (error) throw error
      return Number(data ?? 0)
    },
    onSuccess: invalidate,
  })
}
