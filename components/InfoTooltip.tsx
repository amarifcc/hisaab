'use client'

import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// Click-to-open dark tooltip — matches the Cashbook header info affordance.
export default function InfoTooltip({ text, label = 'More info', width = 'w-64' }: {
  text: string
  label?: string
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-slate-300 active:text-slate-500"
        aria-label={label}
      >
        <Info size={15} />
      </button>
      {open && (
        <div className={cn('absolute top-full left-0 mt-1.5 bg-slate-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-lg z-30 leading-relaxed', width)}>
          {text}
        </div>
      )}
    </div>
  )
}
