'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu, X, ListOrdered,
  BarChart2, ChevronDown, ChevronRight, Layers, Tag, Users, LogOut, Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

const mainNav = [
  { href: '/reports',  icon: BarChart2,      label: 'Reports'   },
  { href: '/records', icon: ListOrdered, label: 'Records' },
]

const settingsNav = [
  { href: '/settings/parts',      icon: Layers, label: 'Project Parts' },
  { href: '/settings/categories', icon: Tag,    label: 'Categories'      },
  { href: '/settings/people',     icon: Users,  label: 'People'        },
]

interface Props {
  userName: string
  userRole: string
}

export default function Sidebar({ userName, userRole }: Props) {
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const isSettingsActive = pathname.startsWith('/settings')

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Top header bar */}
      <header className="fixed top-0 left-0 right-0 h-12 bg-white border-b border-slate-100 flex items-center px-4 z-40 safe-top">
        <button onClick={() => setOpen(true)} className="p-1 -ml-1 text-slate-600">
          <Menu size={22} />
        </button>
        <span className="ml-3 text-base font-bold text-slate-900">Hisaab</span>
        <div className="ml-auto">
          <ThemeToggle compact />
        </div>
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-72 bg-white z-50 flex flex-col transition-transform duration-250 ease-in-out shadow-xl',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-700 rounded-xl flex items-center justify-center">
              <span className="text-white text-sm font-bold">ح</span>
            </div>
            <span className="font-bold text-slate-900">Hisaab</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-slate-400 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {mainNav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            )
          })}

          {/* Settings section */}
          <div className="pt-2">
            <button
              onClick={() => setSettingsOpen(s => !s)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isSettingsActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              <div className="flex items-center gap-3">
                <Settings size={18} strokeWidth={isSettingsActive ? 2.5 : 1.8} />
                Settings
              </div>
              {settingsOpen || isSettingsActive
                ? <ChevronDown size={15} />
                : <ChevronRight size={15} />}
            </button>

            {(settingsOpen || isSettingsActive) && (
              <div className="ml-6 mt-0.5 space-y-0.5">
                {settingsNav.map(({ href, icon: Icon, label }) => {
                  const active = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors',
                        active
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-slate-500 hover:bg-slate-50'
                      )}
                    >
                      <Icon size={15} />
                      {label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Account footer */}
        <div className="border-t border-slate-100 px-4 py-4 safe-bottom">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">{userName}</p>
              <p className="text-xs text-slate-400 capitalize">{userRole}</p>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle compact />
              <button onClick={handleSignOut} className="text-slate-400 active:text-red-600 p-2">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
