'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, BookOpen, Settings, Wallet, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'

const supervisorNav = [
  { href: '/home',     icon: House,    label: 'Home'     },
  { href: '/cashbook', icon: BookOpen, label: 'Cashbook' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

// Owner: views the supervisor app (Home) read-only + writes in their own module.
const ownerNav = [
  { href: '/home',         icon: House,    label: 'Home'        },
  { href: '/owner',        icon: Wallet,   label: 'My Expenses' },
  { href: '/owner/report', icon: PieChart, label: 'My Report'   },
]

// Viewer: read-only — no Settings.
const viewerNav = [
  { href: '/home',     icon: House,    label: 'Home'     },
  { href: '/cashbook', icon: BookOpen, label: 'Cashbook' },
]

export default function BottomNav({ role }: { role?: string }) {
  const pathname = usePathname()
  const navItems = role === 'owner' ? ownerNav : role === 'supervisor' ? supervisorNav : viewerNav

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 safe-bottom z-40">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          // '/owner' must match exactly so it doesn't stay active on '/owner/report'.
          const active = href === '/owner' ? pathname === '/owner' : (pathname === href || pathname.startsWith(href + '/'))
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
  )
}
