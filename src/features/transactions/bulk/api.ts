import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { BatchRow, ExistingTx } from './model'

/*
  Gravação do lançamento em massa. Uma única chamada à função create_transactions_batch, que grava o lote
  inteiro numa transação (tudo ou nada) e usa o id do lote para não duplicar em reenvios.
*/

export type BatchResult = { inserted: number; alreadySaved: boolean }

export function useCreateBatch(spaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ batchId, rows }: { batchId: string; rows: BatchRow[] }): Promise<BatchResult> => {
      const { data, error } = await supabase.rpc('create_transactions_batch', {
        p_space_id: spaceId,
        p_batch_id: batchId,
        p_rows: rows as unknown as Json,
      })
      if (error) throw error
      const r = data?.[0]
      return { inserted: Number(r?.inserted ?? 0), alreadySaved: Boolean(r?.already_saved) }
    },
    // Mesmas chaves invalidadas pelo formulário individual: listas, totais, saldos e faturas.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions', spaceId] }),
        queryClient.invalidateQueries({ queryKey: ['accounts', spaceId] }),
      ]),
  })
}

/** Movimentações já gravadas no intervalo, para o alerta de possíveis duplicados. */
export async function fetchExistingForDuplicates(spaceId: string, from: string, to: string): Promise<ExistingTx[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('occurred_on, amount, description, account_id')
    .eq('space_id', spaceId)
    .gte('occurred_on', from)
    .lte('occurred_on', to)
    .limit(5000)
  if (error) throw error
  return (data ?? []).map((t) => ({ occurred_on: t.occurred_on, amount: Number(t.amount), description: t.description, account_id: t.account_id }))
}
