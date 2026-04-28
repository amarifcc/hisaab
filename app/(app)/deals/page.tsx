export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import DealsList from './DealsList'

export default async function DealsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isSupervisor = false
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isSupervisor = (data as { role?: string } | null)?.role === 'supervisor'
  }

  const [{ data: deals }, { data: parts }, { data: expenses }] = await Promise.all([
    supabase.from('deals').select('*, project_parts(*)').order('date', { ascending: false }),
    supabase.from('project_parts').select('*').order('sort_order'),
    supabase.from('expenses')
      .select('paid_to, expense_allocations(part_id, amount)')
      .not('paid_to', 'is', null),
  ])

  // Build paidMap[person_name][part_id] = total paid via expenses
  const paidMap: Record<string, Record<string, number>> = {}
  for (const exp of expenses ?? []) {
    if (!exp.paid_to) continue
    const person = exp.paid_to as string
    if (!paidMap[person]) paidMap[person] = {}
    for (const alloc of (exp as any).expense_allocations ?? []) {
      paidMap[person][alloc.part_id] = (paidMap[person][alloc.part_id] ?? 0) + Number(alloc.amount)
    }
  }

  return (
    <DealsList
      initialDeals={deals ?? []}
      parts={parts ?? []}
      paidMap={paidMap}
      isSupervisor={isSupervisor}
    />
  )
}
