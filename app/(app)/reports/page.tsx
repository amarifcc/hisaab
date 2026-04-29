export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import ReportsView from './ReportsView'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isSupervisor = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isSupervisor = (profile as { role?: string } | null)?.role === 'supervisor'
  }

  const [{ data: parts }, { data: transfers }, { data: expenses }, { data: categories }, { data: deals }] = await Promise.all([
    supabase.from('project_parts').select('*').order('sort_order'),
    supabase.from('transfers').select('*, project_parts(*)').order('date', { ascending: false }),
    supabase.from('expenses').select('*, categories(*), expense_allocations(*, project_parts(*))').order('date', { ascending: false }),
    supabase.from('categories').select('*').order('name'),
    supabase.from('deals').select('*, project_parts(*)').order('date', { ascending: false }),
  ])

  // paidMap[person_name][part_id] = total paid via expenses
  const paidMap: Record<string, Record<string, number>> = {}
  for (const exp of expenses ?? []) {
    if (!(exp as any).paid_to) continue
    const person = (exp as any).paid_to as string
    if (!paidMap[person]) paidMap[person] = {}
    for (const alloc of (exp as any).expense_allocations ?? []) {
      paidMap[person][alloc.part_id] = (paidMap[person][alloc.part_id] ?? 0) + Number(alloc.amount)
    }
  }

  return (
    <ReportsView
      parts={parts ?? []}
      transfers={transfers ?? []}
      expenses={expenses ?? []}
      categories={categories ?? []}
      deals={deals ?? []}
      paidMap={paidMap}
      isSupervisor={isSupervisor}
    />
  )
}
