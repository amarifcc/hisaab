export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import UsersManager from './UsersManager'

type RoleProfile = { role?: string | null }

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as RoleProfile | null)?.role !== 'supervisor') {
    return <div className="px-4 pt-8 text-center text-slate-400 text-sm">Supervisor access required.</div>
  }

  const [{ data: users }, { data: parts }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, role, part_id, project_parts(id, name, short_name, color)')
      .order('name'),
    supabase.from('project_parts').select('id, name, short_name, color').order('sort_order'),
  ])

  // Supabase types the embedded one-to-one relation as an array — normalize to a single object.
  const normalized = (users ?? []).map(u => ({
    ...u,
    project_parts: Array.isArray(u.project_parts) ? (u.project_parts[0] ?? null) : u.project_parts,
  }))

  return <UsersManager initialUsers={normalized} parts={parts ?? []} currentUserId={user.id} />
}
