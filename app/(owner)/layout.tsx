import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OwnerShell from '@/components/OwnerShell'

export const dynamic = 'force-dynamic'

type OwnerProfile = {
  name: string | null
  role: string | null
  part_id: string | null
  project_parts: { name: string; short_name: string; color: string } | { name: string; short_name: string; color: string }[] | null
}

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, part_id, project_parts(name, short_name, color)')
    .eq('id', user.id)
    .single()

  const p = profile as OwnerProfile | null
  // Only owners belong here; everyone else goes back to the supervisor entry point.
  if (p?.role !== 'owner') redirect('/')

  const part = Array.isArray(p.project_parts) ? p.project_parts[0] : p.project_parts

  return (
    <OwnerShell
      userName={p.name ?? 'Owner'}
      partName={part?.short_name ?? '—'}
      partColor={part?.color ?? '#6366f1'}
    >
      {children}
    </OwnerShell>
  )
}
