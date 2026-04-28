export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import TransfersList from './TransfersList'

export default async function TransfersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isSupervisor = false
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isSupervisor = (data as { role?: string } | null)?.role === 'supervisor'
  }

  const [{ data: transfers }, { data: parts }] = await Promise.all([
    supabase.from('transfers').select('*, project_parts(*)').order('date', { ascending: false }),
    supabase.from('project_parts').select('*').order('sort_order'),
  ])

  return (
    <TransfersList
      initialTransfers={transfers ?? []}
      parts={parts ?? []}
      isSupervisor={isSupervisor}
    />
  )
}
