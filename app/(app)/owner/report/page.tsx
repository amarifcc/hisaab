export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CombinedReportView from '@/components/CombinedReportView'
import type { ProjectPart, Category, ExpenseWithDetails } from '@/lib/types'

export default async function OwnerReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, part_id').eq('id', user.id).single()
  const p = profile as { role?: string; part_id?: string | null } | null
  if (p?.role !== 'owner' || !p.part_id) redirect('/home')

  const [{ data: part }, { data: categories }, { data: expenses }] = await Promise.all([
    supabase.from('project_parts').select('*').eq('id', p.part_id).single(),
    supabase.from('categories').select('*').order('name'),
    // Both sources, but only this owner's part — the merged view of their floor.
    supabase
      .from('expenses')
      .select('*, categories(*), expense_allocations(*, project_parts(*))')
      .order('date', { ascending: false }),
  ])

  if (!part) redirect('/home')

  // Keep only expenses that touch this part (supervisor multi-part + owner single-part).
  const partId = p.part_id
  const scoped = ((expenses ?? []) as ExpenseWithDetails[]).filter(e =>
    (e.expense_allocations ?? []).some(a => a.part_id === partId)
  )

  return (
    <CombinedReportView
      parts={[part as ProjectPart]}
      categories={(categories ?? []) as Category[]}
      expenses={scoped}
      title="Combined Report"
      subtitle={`Supervisor + your spend on ${(part as ProjectPart).name}`}
      ownerView
    />
  )
}
