export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Layers, Tag, Users, ChevronRight } from 'lucide-react'

type RoleProfile = { role?: string | null }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isSupervisor = (profile as RoleProfile | null)?.role === 'supervisor'

  if (!isSupervisor) {
    return (
      <div className="px-4 pt-5">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Settings</h1>
        <p className="text-sm text-slate-400">Only the supervisor can manage settings.</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-5 pb-6">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Settings</h1>
      <p className="text-sm text-slate-400 mb-5">Manage your project setup</p>

      <div className="space-y-2">
        <Link
          href="/settings/parts"
          className="flex items-center justify-between bg-white rounded-2xl px-4 py-4 border border-slate-100 shadow-sm active:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Layers size={20} className="text-blue-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Project Parts</p>
              <p className="text-xs text-slate-400">Add, edit or delete floors / sections</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-300" />
        </Link>

        <Link
          href="/settings/categories"
          className="flex items-center justify-between bg-white rounded-2xl px-4 py-4 border border-slate-100 shadow-sm active:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Tag size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Expense Categories</p>
              <p className="text-xs text-slate-400">Add, edit or delete expense tags</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-300" />
        </Link>
        <Link
          href="/settings/people"
          className="flex items-center justify-between bg-white rounded-2xl px-4 py-4 border border-slate-100 shadow-sm active:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">People</p>
              <p className="text-xs text-slate-400">Names used in transfers &amp; expenses</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-300" />
        </Link>
      </div>

    </div>
  )
}
