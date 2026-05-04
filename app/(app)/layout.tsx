import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const role = (profile as any)?.role ?? 'viewer'

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        userName={(profile as any)?.name ?? ''}
        userRole={role}
      />
      {/* Top header spacer */}
      <div className="h-12" />
      <main className="max-w-lg mx-auto pb-16">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
