export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import CashbookView from './CashbookView'

export default async function CashbookPage() {
  const supabase = await createClient()

  const [{ data: parts }, { data: transfers }, { data: expenses }] = await Promise.all([
    supabase.from('project_parts').select('*').order('sort_order'),
    supabase.from('transfers').select('*, project_parts(*)').order('date', { ascending: true }),
    supabase.from('expenses').select('*, expense_allocations(*, project_parts(*))').order('date', { ascending: true }),
  ])

  return (
    <CashbookView
      parts={parts ?? []}
      transfers={transfers ?? []}
      expenses={expenses ?? []}
    />
  )
}
