'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Person { id: string; name: string; person_type: string }

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  personType?: 'owner' | 'contractor' | 'employee' | 'supplier' | Array<'owner' | 'contractor' | 'employee' | 'supplier'>
  hasError?: boolean
}

export default function PersonPicker({ value, onChange, placeholder = 'Select or type a name…', personType, hasError }: Props) {
  const [people, setPeople] = useState<Person[]>([])
  const [inputFocused, setInputFocused] = useState(false)

  useEffect(() => {
    let url = '/api/people'
    if (Array.isArray(personType)) {
      url = `/api/people?types=${personType.join(',')}`
    } else if (personType) {
      url = `/api/people?type=${personType}`
    }
    fetch(url).then(r => r.json()).then(setPeople).catch(() => {})
  }, [JSON.stringify(personType)])

  const filtered = value.trim()
    ? people.filter(p => p.name.toLowerCase().includes(value.toLowerCase()))
    : people

  const showDropdown = inputFocused && filtered.length > 0

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setTimeout(() => setInputFocused(false), 150)}
        placeholder={placeholder}
        className={cn('w-full px-4 py-3 rounded-xl border text-slate-900 focus:outline-none focus:ring-2 text-sm',
          hasError ? 'border-red-400 ring-1 ring-red-400 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'
        )}
      />

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => onChange(p.name)}
              className={cn(
                'w-full text-left px-4 py-3 text-sm flex items-center gap-2.5 transition-colors',
                value === p.name ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <div className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-violet-600">{p.name.charAt(0).toUpperCase()}</span>
              </div>
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
