export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import RecordsView from './RecordsView'

type PaidExpenseRow = {
  paid_to: string | null
  expense_allocations?: { part_id: string; amount: number }[]
}

export default async function RecordsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isSupervisor = false
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isSupervisor = (data as { role?: string } | null)?.role === 'supervisor'
  }

  const [
    { data: parts },
    { data: transfers },
    { data: expenses },
    { data: dealsWithRevisions, error: dealsWithRevisionsError },
    { data: paidExpenses },
  ] = await Promise.all([
    supabase.from('project_parts').select('*').order('sort_order'),
    supabase.from('transfers').select('*, project_parts(*)').order('date', { ascending: false }),
    supabase.from('expenses')
      .select('*, categories(*), expense_allocations(*, project_parts(*))')
      .order('date', { ascending: false }),
    supabase.from('deals').select('*, project_parts(*), deal_revisions(*)').order('date', { ascending: false }),
    supabase.from('expenses')
      .select('paid_to, expense_allocations(part_id, amount)')
      .not('paid_to', 'is', null),
  ])

  let deals = dealsWithRevisions
  if (dealsWithRevisionsError) {
    const { data: fallbackDeals } = await supabase.from('deals').select('*, project_parts(*)').order('date', { ascending: false })
    deals = fallbackDeals
  }

  const paidMap: Record<string, Record<string, number>> = {}
  for (const exp of (paidExpenses ?? []) as PaidExpenseRow[]) {
    if (!exp.paid_to) continue
    if (!paidMap[exp.paid_to]) paidMap[exp.paid_to] = {}
    for (const alloc of exp.expense_allocations ?? []) {
      paidMap[exp.paid_to][alloc.part_id] = (paidMap[exp.paid_to][alloc.part_id] ?? 0) + Number(alloc.amount)
    }
  }

  return (
    <RecordsView
      parts={parts ?? []}
      transfers={transfers ?? []}
      expenses={expenses ?? []}
      deals={deals ?? []}
      paidMap={paidMap}
      isSupervisor={isSupervisor}
    />
  )
}
