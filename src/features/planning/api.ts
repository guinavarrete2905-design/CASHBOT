import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Budget = { id: string; categoryId: string; amount: number }

export type Goal = {
  id: string
  name: string
  target: number
  saved: number
  targetDate: string | null
  archived: boolean
  createdBy: string | null
}

const planningKey = (spaceId: string) => ['planning', spaceId] as const

export function useBudgets(spaceId: string | undefined) {
  return useQuery({
    queryKey: [...planningKey(spaceId ?? 'none'), 'budgets'],
    enabled: Boolean(spaceId),
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase.from('budgets').select('id, category_id, amount').eq('space_id', spaceId!)
      if (error) throw error
      return (data ?? []).map((b) => ({ id: b.id, categoryId: b.category_id, amount: Number(b.amount) }))
    },
  })
}

export function useGoals(spaceId: string | undefined) {
  return useQuery({
    queryKey: [...planningKey(spaceId ?? 'none'), 'goals'],
    enabled: Boolean(spaceId),
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('space_id', spaceId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        target: Number(g.target_amount),
        saved: Number(g.saved_amount),
        targetDate: g.target_date,
        archived: g.archived,
        createdBy: g.created_by,
      }))
    },
  })
}

function useInvalidate(spaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: planningKey(spaceId) })
}

/** Cria ou altera o limite mensal de uma categoria. */
export function useSaveBudget(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (input: { categoryId: string; amount: number }) => {
      const { error } = await supabase
        .from('budgets')
        .upsert({ space_id: spaceId, category_id: input.categoryId, amount: input.amount }, { onConflict: 'space_id,category_id' })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteBudget(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export type GoalInput = { name: string; target: number; saved: number; targetDate: string | null }

export function useSaveGoal(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async ({ id, ...input }: GoalInput & { id?: string }) => {
      const row = {
        name: input.name.trim(),
        target_amount: input.target,
        saved_amount: input.saved,
        target_date: input.targetDate,
      }
      if (id) {
        const { data, error } = await supabase.from('goals').update(row).eq('id', id).select('id')
        if (error) throw error
        if (!data || data.length === 0) throw new Error('Você não tem permissão para editar esta meta.')
      } else {
        const { error } = await supabase.from('goals').insert({ space_id: spaceId, ...row })
        if (error) throw error
      }
    },
    onSuccess: invalidate,
  })
}

export function useUpdateGoalSaved(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: number }) => {
      const { data, error } = await supabase.from('goals').update({ saved_amount: saved }).eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Você não tem permissão para editar esta meta.')
    },
    onSuccess: invalidate,
  })
}

export function useDeleteGoal(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('goals').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Só quem criou a meta, o proprietário ou um administrador pode excluí-la.')
      }
    },
    onSuccess: invalidate,
  })
}
