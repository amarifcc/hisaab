'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, BookOpen, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/home',     icon: House,       label: 'Home'     },
  { href: '/cashbook', icon: BookOpen,    label: 'Cashbook' },
  { href: '/settings', icon: Settings,    label: 'Settings' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 safe-bottom z-40">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
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
