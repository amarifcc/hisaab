export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import PeopleManager from './PeopleManager'

export default async function PeoplePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'supervisor') {
    return <div className="px-4 pt-8 text-center text-slate-400 text-sm">Supervisor access required.</div>
  }

  const [{ data: people }, { data: parts }] = await Promise.all([
    supabase.from('people').select('*').order('name'),
    supabase.from('project_parts').select('id, name, color').order('name'),
  ])
  return <PeopleManager initialPeople={people ?? []} parts={parts ?? []} />
}
