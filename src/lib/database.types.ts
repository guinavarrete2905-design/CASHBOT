// Tipos gerados a partir do banco (Supabase) — somente as tabelas e funções da v2.
// Para regenerar: `npx supabase gen types typescript --project-id twgpqbmmgfaudpcscwhe`
// e manter apenas o schema público usado pelo app.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.17'
  }
  public: {
    Tables: {
      categories: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          id: string
          kind: string
          name: string
          space_id: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          id?: string
          kind: string
          name: string
          space_id: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_space_id_fkey'
            columns: ['space_id']
            isOneToOne: false
            referencedRelation: 'spaces'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      space_members: {
        Row: {
          created_at: string
          role: string
          space_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          space_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'space_members_space_id_fkey'
            columns: ['space_id']
            isOneToOne: false
            referencedRelation: 'spaces'
            referencedColumns: ['id']
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          settings: Json
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          settings?: Json
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          settings?: Json
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          external_ref: string | null
          id: string
          kind: string
          notes: string | null
          occurred_on: string
          space_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          external_ref?: string | null
          id?: string
          kind: string
          notes?: string | null
          occurred_on: string
          space_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          external_ref?: string | null
          id?: string
          kind?: string
          notes?: string | null
          occurred_on?: string
          space_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_space_id_fkey'
            columns: ['space_id']
            isOneToOne: false
            referencedRelation: 'spaces'
            referencedColumns: ['id']
          },
        ]
      }
      user_preferences: {
        Row: {
          currency: string
          default_space_id: string | null
          locale: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          currency?: string
          default_space_id?: string | null
          locale?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          currency?: string
          default_space_id?: string | null
          locale?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_preferences_default_space_id_fkey'
            columns: ['default_space_id']
            isOneToOne: false
            referencedRelation: 'spaces'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_space_member: {
        Args: { p_email: string; p_role?: string; p_space_id: string }
        Returns: undefined
      }
      create_space: {
        Args: { p_name: string; p_type: string }
        Returns: string
      }
      is_space_member: { Args: { p_space_id: string }; Returns: boolean }
      shares_space_with: { Args: { p_user_id: string }; Returns: boolean }
      space_role: { Args: { p_space_id: string }; Returns: string }
      update_space_member_role: {
        Args: { p_role: string; p_space_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
