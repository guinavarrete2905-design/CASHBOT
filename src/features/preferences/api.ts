import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { useUser } from '@/providers/AuthProvider'

export type Preferences = Tables<'user_preferences'>
export type ThemePreference = 'system' | 'light' | 'dark'

export const preferencesKey = (userId: string) => ['preferences', userId] as const

export function usePreferences() {
  const user = useUser()
  return useQuery({
    queryKey: preferencesKey(user.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

type PreferencesPatch = Partial<Pick<Preferences, 'theme' | 'currency' | 'default_space_id'>>

export function useUpdatePreferences() {
  const user = useUser()
  const queryClient = useQueryClient()
  const key = preferencesKey(user.id)

  return useMutation({
    mutationFn: async (patch: PreferencesPatch) => {
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' })
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Preferences | null>(key)
      if (previous) queryClient.setQueryData<Preferences>(key, { ...previous, ...patch })
      return { previous }
    },
    onError: (_err, _patch, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(key, data)
    },
  })
}
