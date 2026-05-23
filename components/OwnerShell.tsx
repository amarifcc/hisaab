'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Wallet, PieChart, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/owner', icon: Wallet, label: 'My Expenses' },
  { href: '/owner/report', icon: PieChart, label: 'Report' },
]

interface Props {
  userName: string
  partName: string
  partColor: string
  children: React.ReactNode
}

export default function OwnerShell({ userName, partName, partColor, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-100 z-40">
        <div className="max-w-lg mx-auto h-12 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-slate-900 truncate">{userName}</span>
            <span
              className="text-[11px] px-1.5 py-0.5 rounded text-white flex-shrink-0"
              style={{ backgroundColor: partColor }}
            >
              {partName}
            </span>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-1 text-xs text-red-600 font-medium">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <div className="h-12" />
      <main className="max-w-lg mx-auto pb-16">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 safe-bottom z-40">
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors',
                  active ? 'text-blue-700' : 'text-slate-400'
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
