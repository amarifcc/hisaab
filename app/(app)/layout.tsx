import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import PageVisitTracker from '@/components/PageVisitTracker'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type AppProfile = {
  name?: string | null
  role?: string | null
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const appProfile = profile as AppProfile | null
  const role = appProfile?.role ?? 'viewer'

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        userName={appProfile?.name ?? ''}
        userRole={role}
      />
      <PageVisitTracker />
      {/* Top header spacer */}
      <div className="h-12" />
      <main className="max-w-lg mx-auto pb-16">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
