import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/providers/AuthProvider'

export const profileKey = (userId: string) => ['profile', userId] as const

export function useProfile() {
  const user = useUser()
  return useQuery({
    queryKey: profileKey(user.id),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProfile() {
  const user = useUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { fullName: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: input.fullName.trim() })
        .eq('id', user.id)
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(profileKey(user.id), data)
      // Nomes aparecem também nas listas de membros.
      queryClient.invalidateQueries({ queryKey: ['space-members'] })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
  })
}
