import Sidebar from '@/components/Sidebar'
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        userName={(profile as any)?.name ?? ''}
        userRole={(profile as any)?.role ?? 'viewer'}
      />
      {/* Top header spacer */}
      <div className="h-12" />
      <main className="max-w-lg mx-auto">
        {children}
      </main>
    </div>
  )
}
