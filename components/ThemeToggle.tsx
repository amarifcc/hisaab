'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const THEME_KEY = 'hisaab_theme'

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY)
    const nextTheme = saved === 'dark' ? 'dark' : 'light'
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }, [])

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem(THEME_KEY, nextTheme)
    applyTheme(nextTheme)
  }

  const Icon = theme === 'dark' ? Sun : Moon

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 active:text-blue-600 transition-colors',
        compact ? 'w-8 h-8' : 'w-9 h-9'
      )}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Icon size={compact ? 16 : 17} />
    </button>
  )
}
