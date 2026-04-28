export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import ReportsView from './ReportsView'

export default async function ReportsPage() {
  const supabase = await createClient()

  const [{ data: parts }, { data: transfers }, { data: expenses }, { data: categories }] = await Promise.all([
    supabase.from('project_parts').select('*').order('sort_order'),
    supabase.from('transfers').select('*, project_parts(*)').order('date', { ascending: false }),
    supabase.from('expenses').select('*, categories(*), expense_allocations(*, project_parts(*))').order('date', { ascending: false }),
    supabase.from('categories').select('*').order('name'),
  ])

  return (
    <ReportsView
      parts={parts ?? []}
      transfers={transfers ?? []}
      expenses={expenses ?? []}
      categories={categories ?? []}
    />
  )
}
