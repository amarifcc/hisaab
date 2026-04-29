export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Views: Record<string, { Row: Record<string, unknown> }>
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
    Enums: Record<string, string>
    CompositeTypes: Record<string, Record<string, unknown>>
    Tables: {
      project_parts: {
        Row: {
          id: string
          name: string
          short_name: string
          color: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          short_name: string
          color?: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          name?: string
          short_name?: string
          color?: string
          sort_order?: number
        }
      }
      profiles: {
        Row: {
          id: string
          name: string
          role: 'supervisor' | 'viewer'
          created_at: string
        }
        Insert: {
          id: string
          name: string
          role: 'supervisor' | 'viewer'
          created_at?: string
        }
        Update: {
          name?: string
          role?: 'supervisor' | 'viewer'
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          color: string
          parent_id: string | null
          is_group: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
          parent_id?: string | null
          is_group?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          color?: string
          parent_id?: string | null
          is_group?: boolean
        }
      }
      transfers: {
        Row: {
          id: string
          part_id: string
          from_person: string | null
          amount: number
          date: string
          notes: string | null
          ref_number: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          part_id: string
          from_person?: string | null
          amount: number
          date?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          part_id?: string
          from_person?: string | null
          amount?: number
          date?: string
          notes?: string | null
          updated_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          description: string
          total_amount: number
          paid_to: string | null
          category_id: string | null
          date: string
          notes: string | null
          ref_number: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          description: string
          total_amount: number
          paid_to?: string | null
          category_id?: string | null
          date?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          description?: string
          total_amount?: number
          paid_to?: string | null
          category_id?: string | null
          date?: string
          notes?: string | null
          updated_at?: string
        }
      }
      expense_allocations: {
        Row: {
          id: string
          expense_id: string
          part_id: string
          amount: number
        }
        Insert: {
          id?: string
          expense_id: string
          part_id: string
          amount: number
        }
        Update: {
          amount?: number
        }
      }
      activity_logs: {
        Row: {
          id: string
          action: 'CREATE' | 'UPDATE' | 'DELETE'
          entity_type: 'transfer' | 'expense' | 'category' | 'project_part'
          entity_id: string | null
          summary: string
          changes: Json | null
          performed_by: string | null
          performed_at: string
        }
        Insert: {
          id?: string
          action: 'CREATE' | 'UPDATE' | 'DELETE'
          entity_type: 'transfer' | 'expense' | 'category' | 'project_part'
          entity_id?: string | null
          summary: string
          changes?: Json | null
          performed_by?: string | null
          performed_at?: string
        }
        Update: never
      }
    }
  }
}

export type ProjectPart = Database['public']['Tables']['project_parts']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Transfer = Database['public']['Tables']['transfers']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type ExpenseAllocation = Database['public']['Tables']['expense_allocations']['Row']
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']

export interface Deal {
  id: string
  name: string
  person_name: string | null
  part_id: string
  agreed_amount: number
  date: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Enriched types used in UI
export type TransferWithPart = Transfer & { project_parts: ProjectPart }
export type ExpenseWithDetails = Expense & {
  categories: Category | null
  expense_allocations: (ExpenseAllocation & { project_parts: ProjectPart })[]
}
export type DealWithPart = Deal & { project_parts: ProjectPart }
