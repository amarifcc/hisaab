export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OwnerView from './OwnerView'
import type { ProjectPart } from '@/lib/types'

export default async function OwnerHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, part_id').eq('id', user.id).single()
  const p = profile as { role?: string; part_id?: string | null } | null
  // Owner-only module. Supervisors/viewers don't have a "my own spend" — send them home.
  if (p?.role !== 'owner' || !p.part_id) redirect('/home')

  const [{ data: part }, { data: categories }, { data: expenses }] = await Promise.all([
    supabase.from('project_parts').select('*').eq('id', p.part_id).single(),
    supabase.from('categories').select('*').order('name'),
    supabase
      .from('expenses')
      .select('*, categories(*), expense_allocations(*, project_parts(*))')
      .eq('source', 'owner')
      .eq('created_by', user.id)
      .order('date', { ascending: false }),
  ])

  if (!part) redirect('/home')

  return (
    <OwnerView
      part={part as ProjectPart}
      categories={categories ?? []}
      initialExpenses={expenses ?? []}
    />
  )
}
