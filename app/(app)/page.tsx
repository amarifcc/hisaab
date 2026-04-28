export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import DashboardView from './DashboardView'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isSupervisor = false
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isSupervisor = (data as { role?: string } | null)?.role === 'supervisor'
  }

  const [{ data: parts }, { data: transfers }, { data: expenses }, { data: allocations }] =
    await Promise.all([
      supabase.from('project_parts').select('*').order('sort_order'),
      supabase.from('transfers').select('*, project_parts(*)').order('date', { ascending: false }),
      supabase.from('expenses')
        .select('*, categories(*), expense_allocations(*, project_parts(*))')
        .order('date', { ascending: false }),
      supabase.from('expense_allocations').select('part_id, amount'),
    ])

  return (
    <DashboardView
      parts={parts ?? []}
      transfers={transfers ?? []}
      expenses={expenses ?? []}
      allocations={allocations ?? []}
      isSupervisor={isSupervisor}
    />
  )
}
