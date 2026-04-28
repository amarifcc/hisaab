export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CategoriesManager from './CategoriesManager'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'supervisor') {
    return <div className="px-4 pt-8 text-center text-slate-400 text-sm">Supervisor access required.</div>
  }

  const { data: categories } = await supabase.from('categories').select('*').order('name')

  return <CategoriesManager initialCategories={categories ?? []} />
}
