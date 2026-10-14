import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/*
  Histórico de conversas do Assistente Financeiro (tabela assistant_messages).
  Cada mensagem pertence ao usuário logado e a um espaço; o RLS impede que outra pessoa leia ou apague.
*/

export type StoredMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string }

const HISTORY_LIMIT = 40
export const historyKey = (spaceId: string) => ['assistant-history', spaceId] as const

export function useAssistantHistory(spaceId: string | undefined) {
  return useQuery({
    queryKey: historyKey(spaceId ?? 'none'),
    enabled: Boolean(spaceId),
    staleTime: Infinity,
    queryFn: async (): Promise<StoredMessage[]> => {
      const { data, error } = await supabase
        .from('assistant_messages')
        .select('id, role, content, created_at')
        .eq('space_id', spaceId!)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)
      if (error) throw error
      return (data ?? [])
        .reverse()
        .map((m) => ({ id: m.id, role: m.role === 'user' ? 'user' : 'assistant', content: m.content, createdAt: m.created_at }))
    },
  })
}

export async function saveMessages(spaceId: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const rows = messages
    .map((m) => ({ space_id: spaceId, role: m.role, content: m.content.trim().slice(0, 4000) }))
    .filter((m) => m.content.length > 0)
  if (!rows.length) return
  const { error } = await supabase.from('assistant_messages').insert(rows)
  if (error) throw error
}

export function useClearHistory(spaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('assistant_messages').delete().eq('space_id', spaceId)
      if (error) throw error
    },
    onSuccess: () => qc.setQueryData(historyKey(spaceId), []),
  })
}
