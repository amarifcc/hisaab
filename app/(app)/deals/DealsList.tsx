'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, Handshake } from 'lucide-react'
import { formatPKR, formatDate, cn } from '@/lib/utils'
import DealSheet from '@/components/DealSheet'
import type { ProjectPart, DealWithPart } from '@/lib/types'

interface Props {
  initialDeals: DealWithPart[]
  parts: ProjectPart[]
  paidMap: Record<string, Record<string, number>>
  isSupervisor: boolean
}

const PART_FILTER_KEY = 'hisab_deals_filter_part'

export default function DealsList({ initialDeals, parts, paidMap, isSupervisor }: Props) {
  const [deals, setDeals] = useState(initialDeals)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<DealWithPart | null>(null)
  const [filterPart, setFilterPart] = useState<string>('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const saved = localStorage.getItem(PART_FILTER_KEY)
    if (saved) setFilterPart(saved)
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function changePartFilter(val: string) {
    setFilterPart(val)
    localStorage.setItem(PART_FILTER_KEY, val)
    setDropdownOpen(false)
  }

  const selectedPart = parts.find(p => p.id === filterPart)
  const filtered = filterPart === 'all' ? deals : deals.filter(d => d.part_id === filterPart)

  // Part-level totals for visible deals
  const partTotals = (() => {
    const totalAgreed = filtered.reduce((s, d) => s + d.agreed_amount, 0)
    let totalPaid = 0
    if (filterPart === 'all') {
      const seen = new Set<string>()
      for (const deal of filtered) {
        if (!deal.person_name || seen.has(deal.person_name)) continue
        seen.add(deal.person_name)
        const partPaid = paidMap[deal.person_name] ?? {}
        totalPaid += Object.values(partPaid).reduce((s, v) => s + v, 0)
      }
    } else {
      const seen = new Set<string>()
      for (const deal of filtered) {
        if (!deal.person_name || seen.has(deal.person_name)) continue
        seen.add(deal.person_name)
        totalPaid += paidMap[deal.person_name]?.[filterPart] ?? 0
      }
    }
    return { totalAgreed, totalPaid, remaining: totalAgreed - totalPaid }
  })()

  // Per-person summary for visible deals
  const personSummary = (() => {
    const map: Record<string, { agreed: number; paid: number }> = {}
    for (const deal of filtered) {
      if (!deal.person_name) continue
      if (!map[deal.person_name]) map[deal.person_name] = { agreed: 0, paid: 0 }
      map[deal.person_name].agreed += deal.agreed_amount

      // Sum paid across relevant parts
      if (filterPart === 'all') {
        const partPaid = paidMap[deal.person_name] ?? {}
        map[deal.person_name].paid = Object.values(partPaid).reduce((s, v) => s + v, 0)
      } else {
        map[deal.person_name].paid = paidMap[deal.person_name]?.[filterPart] ?? 0
      }
    }
    return Object.entries(map)
  })()

  function handleSaved(data: any) {
    if (editing) {
      setDeals(prev => prev.map(d => d.id === data.id ? data : d))
    } else {
      setDeals(prev => [data, ...prev])
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this deal?')) return
    const res = await fetch('/api/deals', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
    if (res.ok) setDeals(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="px-4 pt-5 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Deals</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Part dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              {selectedPart && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedPart.color }} />}
              {selectedPart ? selectedPart.name : 'All Parts'}
              <ChevronDown size={13} className={cn('transition-transform', dropdownOpen && 'rotate-180')} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[160px] overflow-hidden">
                <button
                  onClick={() => changePartFilter('all')}
                  className={cn('w-full text-left px-4 py-3 text-sm font-medium transition-colors',
                    filterPart === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')}
                >
                  All Parts
                </button>
                {parts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => changePartFilter(p.id)}
                    className={cn('w-full text-left px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors',
                      filterPart === p.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isSupervisor && (
            <button
              onClick={() => { setEditing(null); setSheetOpen(true) }}
              className="flex items-center gap-1 bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium"
            >
              <Plus size={15} /> Add
            </button>
          )}
        </div>
      </div>

      {/* Part-level summary card */}
      {filtered.length > 0 && (
        <div className="rounded-2xl px-4 py-3.5 mb-3 shadow-sm"
          style={{ background: selectedPart ? selectedPart.color : '#1d4ed8' }}
        >
          <p className="text-xs font-semibold text-white/70 mb-2">
            {selectedPart ? selectedPart.name : 'All Parts'} — {filtered.length} deal{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-5">
            <div>
              <p className="text-xs text-white/60">Agreed</p>
              <p className="text-base font-bold text-white">PKR {formatPKR(partTotals.totalAgreed)}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Paid</p>
              <p className="text-base font-bold text-emerald-200">PKR {formatPKR(partTotals.totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">{partTotals.remaining < 0 ? 'Overpaid' : 'Remaining'}</p>
              <p className={cn('text-base font-bold', partTotals.remaining < 0 ? 'text-red-200' : 'text-amber-200')}>
                {partTotals.remaining < 0 ? '−' : ''}PKR {formatPKR(Math.abs(partTotals.remaining))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Per-person summary */}
      {personSummary.length > 0 && (
        <div className="space-y-2 mb-4">
          {personSummary.map(([person, { agreed, paid }]) => {
            const remaining = agreed - paid
            return (
              <div key={person} className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-violet-50 flex items-center justify-center">
                      <span className="text-xs font-bold text-violet-600">{person.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{person}</span>
                  </div>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                    remaining < 0 ? 'bg-red-50 text-red-600'
                    : remaining === 0 ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                  )}>
                    {remaining < 0 ? `−PKR ${formatPKR(Math.abs(remaining))} overpaid`
                     : remaining === 0 ? 'Settled'
                     : `PKR ${formatPKR(remaining)} left`}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>Agreed <span className="font-semibold text-slate-700">PKR {formatPKR(agreed)}</span></span>
                  <span>Paid <span className="font-semibold text-emerald-600">PKR {formatPKR(paid)}</span></span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Deals list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-10">No deals</p>
        )}
        {filtered.map(d => {
          const part = d.project_parts
          return (
            <div key={d.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Handshake size={17} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{d.name}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {part && (
                        <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: part.color }}>
                          {part.short_name}
                        </span>
                      )}
                      {d.person_name && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-medium">
                          {d.person_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(d.date)}</p>
                    {d.notes && <p className="text-xs text-slate-400 italic mt-0.5">{d.notes}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                  <span className="text-blue-600 font-bold text-sm">PKR {formatPKR(d.agreed_amount)}</span>
                  {isSupervisor && (
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(d); setSheetOpen(true) }} className="text-slate-400 active:text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(d.id)} className="text-slate-400 active:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <DealSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={handleSaved}
        parts={parts}
        editing={editing}
      />
    </div>
  )
}
