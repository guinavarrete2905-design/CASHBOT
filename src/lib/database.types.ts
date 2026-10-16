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
      accounts: {
        Row: {
          archived: boolean
          closing_day: number | null
          created_at: string
          credit_limit: number | null
          due_day: number | null
          id: string
          initial_balance: number
          name: string
          space_id: string
          type: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          closing_day?: number | null
          created_at?: string
          credit_limit?: number | null
          due_day?: number | null
          id?: string
          initial_balance?: number
          name: string
          space_id: string
          type: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          closing_day?: number | null
          created_at?: string
          credit_limit?: number | null
          due_day?: number | null
          id?: string
          initial_balance?: number
          name?: string
          space_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'accounts_space_id_fkey'
            columns: ['space_id']
            isOneToOne: false
            referencedRelation: 'spaces'
            referencedColumns: ['id']
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          space_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          space_id: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          space_id?: string
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          space_id: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          space_id: string
          type: string
          updated_at?: string
          value: number
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          space_id?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          space_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          space_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          space_id?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      goals: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          saved_amount: number
          space_id: string
          target_amount: number
          target_date: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          saved_amount?: number
          space_id: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          saved_amount?: number
          space_id?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      liabilities: {
        Row: {
          archived: boolean
          balance: number
          created_at: string
          created_by: string | null
          id: string
          monthly_payment: number | null
          name: string
          notes: string | null
          space_id: string
          type: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          balance: number
          created_at?: string
          created_by?: string | null
          id?: string
          monthly_payment?: number | null
          name: string
          notes?: string | null
          space_id: string
          type: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          balance?: number
          created_at?: string
          created_by?: string | null
          id?: string
          monthly_payment?: number | null
          name?: string
          notes?: string | null
          space_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      net_worth_snapshots: {
        Row: {
          accounts: number
          assets: number
          liabilities: number
          month: string
          net_worth: number
          space_id: string
          updated_at: string
        }
        Insert: {
          accounts: number
          assets: number
          liabilities: number
          month: string
          net_worth: number
          space_id: string
          updated_at?: string
        }
        Update: {
          accounts?: number
          assets?: number
          liabilities?: number
          month?: string
          net_worth?: number
          space_id?: string
          updated_at?: string
        }
        Relationships: []
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
          account_id: string | null
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
          series_id: string | null
          series_index: number | null
          series_kind: string | null
          series_total: number | null
          space_id: string
          status: string
          transfer_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
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
          series_id?: string | null
          series_index?: number | null
          series_kind?: string | null
          series_total?: number | null
          space_id: string
          status?: string
          transfer_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
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
          series_id?: string | null
          series_index?: number | null
          series_kind?: string | null
          series_total?: number | null
          space_id?: string
          status?: string
          transfer_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_transfer_account_id_fkey'
            columns: ['transfer_account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
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
      account_balances: {
        Row: {
          account_id: string | null
          balance: number | null
          space_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_space_member: {
        Args: { p_email: string; p_role?: string; p_space_id: string }
        Returns: undefined
      }
      assistant_expenses_by_category: {
        Args: { p_from: string; p_space_id: string; p_to: string }
        Returns: { category_id: string | null; category_name: string | null; total: number; tx_count: number }[]
      }
      assistant_monthly_totals: {
        Args: { p_from: string; p_space_id: string; p_to: string }
        Returns: { expense: number; income: number; month: string }[]
      }
      assistant_period_summary: {
        Args: { p_account_id?: string; p_category_id?: string; p_from: string; p_space_id: string; p_to: string }
        Returns: { expense: number; expense_count: number; income: number; income_count: number; pending_expense: number; pending_income: number }[]
      }
      assistant_top_expenses: {
        Args: { p_category_id?: string; p_from: string; p_limit?: number; p_space_id: string; p_to: string }
        Returns: {
          account_name: string | null
          amount: number
          category_name: string | null
          description: string
          id: string
          occurred_on: string
          status: string
        }[]
      }
      delete_transactions_batch: {
        Args: { p_ids: string[]; p_space_id: string }
        Returns: number
      }
      update_transactions_batch: {
        Args: {
          p_account_id: string | null
          p_category_id: string | null
          p_ids: string[]
          p_set_account: boolean
          p_set_category: boolean
          p_space_id: string
        }
        Returns: number
      }
      create_transactions_batch: {
        Args: { p_batch_id: string; p_rows: Json; p_space_id: string }
        Returns: { already_saved: boolean; inserted: number }[]
      }
      create_space: {
        Args: { p_name: string; p_type: string }
        Returns: string
      }
      is_space_member: { Args: { p_space_id: string }; Returns: boolean }
      record_net_worth_snapshot: {
        Args: { p_space_id: string }
        Returns: {
          accounts: number
          assets: number
          liabilities: number
          month: string
          net_worth: number
          space_id: string
          updated_at: string
        }
      }
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
