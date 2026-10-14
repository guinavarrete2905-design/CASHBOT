import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type CategoryKind = 'expense' | 'income'
export type Category = Omit<Tables<'categories'>, 'kind'> & { kind: CategoryKind }

export const categoriesKey = (spaceId: string) => ['categories', spaceId] as const

export const KIND_LABEL: Record<CategoryKind, string> = {
  expense: 'Despesas',
  income: 'Receitas',
}

export function useCategories(spaceId: string | undefined) {
  return useQuery({
    queryKey: categoriesKey(spaceId ?? 'none'),
    enabled: Boolean(spaceId),
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('space_id', spaceId!)
        .order('name')
      if (error) throw error
      return (data ?? [])
        .filter((c): c is Tables<'categories'> & { kind: CategoryKind } => c.kind === 'expense' || c.kind === 'income')
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    },
  })
}

function useInvalidate(spaceId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: categoriesKey(spaceId) })
}

export function useCreateCategory(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (input: { name: string; kind: CategoryKind }) => {
      const { error } = await supabase
        .from('categories')
        .insert({ space_id: spaceId, name: input.name.trim(), kind: input.kind })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateCategory(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; archived?: boolean }) => {
      const patch: { name?: string; archived?: boolean } = {}
      if (input.name !== undefined) patch.name = input.name.trim()
      if (input.archived !== undefined) patch.archived = input.archived
      const { data, error } = await supabase.from('categories').update(patch).eq('id', input.id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Você não tem permissão para editar esta categoria.')
    },
    onSuccess: invalidate,
  })
}

export function useDeleteCategory(spaceId: string) {
  const invalidate = useInvalidate(spaceId)
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('categories').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Você não tem permissão para excluir esta categoria.')
    },
    onSuccess: invalidate,
  })
}
