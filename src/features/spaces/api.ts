import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { isSpaceRole, isSpaceType, type SpaceRole, type SpaceType } from '@/lib/permissions'
import { useUser } from '@/providers/AuthProvider'

export type Space = Omit<Tables<'spaces'>, 'type'> & { type: SpaceType; role: SpaceRole }

export type SpaceMember = {
  userId: string
  role: SpaceRole
  joinedAt: string
  fullName: string
}

export const spacesKey = (userId: string) => ['spaces', userId] as const
export const membersKey = (spaceId: string) => ['space-members', spaceId] as const

const TYPE_ORDER: Record<SpaceType, number> = { personal: 0, couple: 1, family: 2 }

export function useSpaces() {
  const user = useUser()
  return useQuery({
    queryKey: spacesKey(user.id),
    queryFn: async (): Promise<Space[]> => {
      const { data, error } = await supabase
        .from('space_members')
        .select('role, spaces(*)')
        .eq('user_id', user.id)
      if (error) throw error

      const spaces: Space[] = []
      for (const row of data ?? []) {
        const space = row.spaces
        if (!space || !isSpaceType(space.type) || !isSpaceRole(row.role)) continue
        spaces.push({ ...space, type: space.type, role: row.role })
      }
      return spaces.sort(
        (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name, 'pt-BR'),
      )
    },
  })
}

export function useSpaceMembers(spaceId: string | undefined) {
  return useQuery({
    queryKey: membersKey(spaceId ?? 'none'),
    enabled: Boolean(spaceId),
    queryFn: async (): Promise<SpaceMember[]> => {
      const { data: members, error } = await supabase
        .from('space_members')
        .select('user_id, role, created_at')
        .eq('space_id', spaceId!)
        .order('created_at')
      if (error) throw error

      const ids = (members ?? []).map((m) => m.user_id)
      const names = new Map<string, string>()
      if (ids.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ids)
        if (profileError) throw profileError
        for (const p of profiles ?? []) names.set(p.id, p.full_name)
      }

      return (members ?? [])
        .filter((m) => isSpaceRole(m.role))
        .map((m) => ({
          userId: m.user_id,
          role: m.role as SpaceRole,
          joinedAt: m.created_at,
          fullName: names.get(m.user_id) ?? '',
        }))
    },
  })
}

function useInvalidateSpaces() {
  const user = useUser()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: spacesKey(user.id) })
}

export function useCreateSpace() {
  const invalidate = useInvalidateSpaces()
  return useMutation({
    mutationFn: async (input: { name: string; type: Exclude<SpaceType, 'personal'> }) => {
      const { data, error } = await supabase.rpc('create_space', { p_name: input.name.trim(), p_type: input.type })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })
}

export function useRenameSpace() {
  const invalidate = useInvalidateSpaces()
  return useMutation({
    mutationFn: async (input: { spaceId: string; name: string }) => {
      const { data, error } = await supabase
        .from('spaces')
        .update({ name: input.name.trim() })
        .eq('id', input.spaceId)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Você não tem permissão para renomear este espaço.')
    },
    onSuccess: invalidate,
  })
}

export function useDeleteSpace() {
  const invalidate = useInvalidateSpaces()
  return useMutation({
    mutationFn: async (spaceId: string) => {
      const { data, error } = await supabase.from('spaces').delete().eq('id', spaceId).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Você não tem permissão para excluir este espaço.')
    },
    onSuccess: invalidate,
  })
}

export function useAddMember(spaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; role: Exclude<SpaceRole, 'owner'> }) => {
      const { error } = await supabase.rpc('add_space_member', {
        p_space_id: spaceId,
        p_email: input.email.trim(),
        p_role: input.role,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey(spaceId) }),
  })
}

export function useUpdateMemberRole(spaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { userId: string; role: Exclude<SpaceRole, 'owner'> }) => {
      const { error } = await supabase.rpc('update_space_member_role', {
        p_space_id: spaceId,
        p_user_id: input.userId,
        p_role: input.role,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey(spaceId) }),
  })
}

/** Remove um membro — ou o próprio usuário, quando ele sai do espaço. */
export function useRemoveMember(spaceId: string) {
  const queryClient = useQueryClient()
  const invalidateSpaces = useInvalidateSpaces()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('space_members')
        .delete()
        .eq('space_id', spaceId)
        .eq('user_id', userId)
        .select('user_id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Você não tem permissão para remover este membro.')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: membersKey(spaceId) })
      await invalidateSpaces()
    },
  })
}
