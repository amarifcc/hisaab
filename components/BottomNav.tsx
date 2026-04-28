'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, Receipt, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/',          icon: LayoutDashboard, label: 'Home'      },
  { href: '/transfers', icon: ArrowLeftRight,  label: 'Transfers' },
  { href: '/expenses',  icon: Receipt,         label: 'Expenses'  },
  { href: '/reports',   icon: BarChart2,       label: 'Reports'   },
  { href: '/settings',  icon: Settings,        label: 'Settings'  },
]

export default function BottomNav({ role }: { role: string }) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-bottom z-50">
      <div className="flex items-center justify-around h-14">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors',
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
