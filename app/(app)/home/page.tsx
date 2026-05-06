export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import HomeView from './HomeView'

type PaidExpenseRow = {
  paid_to: string | null
  expense_allocations?: { part_id: string; amount: number }[]
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isSupervisor = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isSupervisor = (profile as { role?: string } | null)?.role === 'supervisor'
  }

  const [{ data: parts }, { data: transfers }, { data: expenses }, { data: categories }, { data: dealsWithRevisions, error: dealsWithRevisionsError }] = await Promise.all([
    supabase.from('project_parts').select('*').order('sort_order'),
    supabase.from('transfers').select('*, project_parts(*)').order('date', { ascending: false }),
    supabase.from('expenses').select('*, categories(*), expense_allocations(*, project_parts(*))').order('date', { ascending: false }),
    supabase.from('categories').select('*').order('name'),
    supabase.from('deals').select('*, project_parts(*), deal_revisions(*)').order('date', { ascending: false }),
  ])
  let deals = dealsWithRevisions
  if (dealsWithRevisionsError) {
    const { data: fallbackDeals } = await supabase.from('deals').select('*, project_parts(*)').order('date', { ascending: false })
    deals = fallbackDeals
  }

  const paidMap: Record<string, Record<string, number>> = {}
  for (const exp of (expenses ?? []) as PaidExpenseRow[]) {
    if (!exp.paid_to) continue
    const person = exp.paid_to
    if (!paidMap[person]) paidMap[person] = {}
    for (const alloc of exp.expense_allocations ?? []) {
      paidMap[person][alloc.part_id] = (paidMap[person][alloc.part_id] ?? 0) + Number(alloc.amount)
    }
  }

  return (
    <HomeView
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
