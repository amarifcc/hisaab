export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CombinedReportView from '@/components/CombinedReportView'
import type { ProjectPart, Category, ExpenseWithDetails } from '@/lib/types'

type JointProfile = {
  role?: string | null
  part_id?: string | null
}

export default async function JointHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, part_id')
    .eq('id', user.id)
    .single()

  const p = profile as JointProfile | null
  const isSupervisor = p?.role === 'supervisor'
  const isOwner = p?.role === 'owner'

  if (!isSupervisor && !isOwner) {
    return <div className="px-4 pt-5"><p className="text-sm text-slate-400">Supervisor or owner access required.</p></div>
  }

  const [{ data: parts }, { data: categories }, { data: expenses }, { data: transfers }] = await Promise.all([
    supabase.from('project_parts').select('*').order('sort_order'),
    supabase.from('categories').select('*').order('name'),
    supabase
      .from('expenses')
      .select('*, categories(*), expense_allocations(*, project_parts(*))')
      .order('date', { ascending: false }),
    supabase.from('transfers').select('part_id, amount'),
  ])

  return (
    <CombinedReportView
      parts={(parts ?? []) as ProjectPart[]}
      categories={(categories ?? []) as Category[]}
      expenses={(expenses ?? []) as ExpenseWithDetails[]}
      transfers={(transfers ?? []) as { part_id: string; amount: number }[]}
      title="Joint Home"
      subtitle="View-only · supervisor + owner-direct spend"
      ownerView={isOwner}
      ownerPartId={isOwner ? p.part_id : null}
    />
  )
}
