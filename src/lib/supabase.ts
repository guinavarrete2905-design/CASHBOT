import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Verdadeiro quando as variáveis públicas do Supabase foram configuradas. */
export const isSupabaseConfigured = Boolean(url && key)

/**
 * Cliente do Supabase com a chave PÚBLICA (publishable/anon).
 * A segurança dos dados é garantida pelas políticas de RLS no banco — nunca use a service_role aqui.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  url ?? 'http://localhost:54321',
  key ?? 'missing-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
