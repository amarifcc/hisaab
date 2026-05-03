'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, Handshake, Search, X, Flag, CheckCircle2, Clock3, Receipt } from 'lucide-react'
import { formatPKR, formatDate, cn } from '@/lib/utils'
import { dealTotal, sortedDealRevisions } from '@/lib/deals'
import DealSheet from '@/components/DealSheet'
import DealRevisionSheet from '@/components/DealRevisionSheet'
import type { ProjectPart, DealRevision, DealWithPart } from '@/lib/types'

interface PaymentRow {
  id: string
  description: string
  date: string
  paid_to: string | null
  notes: string | null
  expense_allocations: { part_id: string; amount: number }[]
}

interface Props {
  initialDeals: DealWithPart[]
  parts: ProjectPart[]
  paidMap: Record<string, Record<string, number>>
  isSupervisor: boolean
  embedded?: boolean
  payments?: PaymentRow[]
}

const PART_FILTER_KEY = 'hisab_deals_filter_part'

export default function DealsList({ initialDeals, parts, paidMap, isSupervisor, embedded = false, payments }: Props) {
  const [deals, setDeals] = useState(initialDeals)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<DealWithPart | null>(null)
  const [revisionDeal, setRevisionDeal] = useState<DealWithPart | null>(null)
  const [editingRevision, setEditingRevision] = useState<DealRevision | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set())
  const [contractorQuery, setContractorQuery] = useState('')
  const [filterPart, setFilterPart] = useState<string>(() =>
    typeof window === 'undefined' ? 'all' : localStorage.getItem(PART_FILTER_KEY) || 'all'
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
  const contractorNeedle = contractorQuery.trim().toLowerCase()
  const filtered = (filterPart === 'all' ? deals : deals.filter(d => d.part_id === filterPart))
    .filter(d => !contractorNeedle || (d.person_name ?? '').toLowerCase().includes(contractorNeedle))
  const groups = (() => {
    const map: Record<string, { person: string; partId: string; part?: ProjectPart; items: DealWithPart[]; agreed: number; paid: number }> = {}
    for (const deal of filtered) {
      const person = deal.person_name || '(unspecified)'
      const key = `${person}::${deal.part_id}`
      if (!map[key]) {
        map[key] = {
          person,
          partId: deal.part_id,
          part: deal.project_parts,
          items: [],
          agreed: 0,
          paid: paidMap[person]?.[deal.part_id] ?? 0,
        }
      }
      map[key].items.push(deal)
      map[key].agreed += dealTotal(deal)
    }
    return Object.values(map).sort((a, b) => b.agreed - a.agreed)
  })()

  // Part-level totals for visible deals
  const partTotals = (() => {
    const totalAgreed = groups.reduce((s, group) => s + group.agreed, 0)
    const totalPaid = groups.reduce((s, group) => s + group.paid, 0)
    return { totalAgreed, totalPaid, remaining: totalAgreed - totalPaid }
  })()

  function handleSaved(data: DealWithPart) {
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

  function handleRevisionSaved(data: DealWithPart) {
    setDeals(prev => prev.map(d => d.id === data.id ? data : d))
  }

  function openAddScope(deal: DealWithPart) {
    setEditingRevision(null)
    setRevisionDeal(deal)
  }

  function openEditRevision(deal: DealWithPart, revision: DealRevision) {
    setEditingRevision(revision)
    setRevisionDeal(deal)
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function togglePayments(key: string) {
    setExpandedPayments(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function dealStatus(remaining: number) {
    if (remaining < 0) {
      return {
        label: 'Overpaid',
        icon: Flag,
        chip: 'bg-red-50 text-red-600',
        text: 'text-red-500',
      }
    }
    if (remaining === 0) {
      return {
        label: 'Fully paid',
        icon: CheckCircle2,
        chip: 'bg-emerald-50 text-emerald-600',
        text: 'text-emerald-600',
      }
    }
    return {
      label: 'Pending',
      icon: Clock3,
      chip: 'bg-amber-50 text-amber-600',
      text: 'text-amber-600',
    }
  }

  return (
    <div className={embedded ? 'pb-4' : 'px-4 pt-5 pb-4'}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {!embedded && <h1 className="text-xl font-bold text-slate-900">Deals</h1>}
          {embedded && <p className="text-xs text-slate-400">{filtered.length} deal{filtered.length !== 1 ? 's' : ''}</p>}
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

      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={contractorQuery}
          onChange={e => setContractorQuery(e.target.value)}
          placeholder="Filter by contractor..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {contractorQuery && (
          <button onClick={() => setContractorQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Contractor + part groups */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-10">No deals</p>
        )}
        {groups.map(group => {
          const remaining = group.agreed - group.paid
          const status = dealStatus(remaining)
          const StatusIcon = status.icon
          const groupKey = `${group.person}-${group.partId}`
          const isExpanded = expandedGroups.has(groupKey)
          const isPaymentsExpanded = expandedPayments.has(groupKey)
          const groupPayments = (payments ?? []).filter(
            e => e.paid_to === group.person && e.expense_allocations.some(a => a.part_id === group.partId)
          ).sort((a, b) => b.date.localeCompare(a.date))
          return (
            <div key={groupKey} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleGroup(groupKey)}
                className="w-full px-4 py-3 bg-white text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-violet-600">{group.person.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{group.person}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {group.part && <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: group.part.color }}>{group.part.short_name}</span>}
                        <span className="text-xs text-slate-400">{group.part?.name ?? 'Part'} · {group.items.length} deal{group.items.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <div className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold mb-0.5', status.chip)}>
                        <StatusIcon size={11} />
                        {status.label}
                      </div>
                      <p className={cn('text-sm font-bold', status.text)}>
                        {remaining < 0 ? '−' : remaining === 0 ? '' : ''}{remaining === 0 ? 'PKR 0' : `PKR ${formatPKR(Math.abs(remaining))}`}
                      </p>
                    </div>
                    <ChevronDown size={14} className={cn('text-slate-300 transition-transform', isExpanded && 'rotate-180')} />
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-slate-500 mt-2">
                  <span>Agreed <span className="font-semibold text-slate-700">PKR {formatPKR(group.agreed)}</span></span>
                  <span>Paid <span className="font-semibold text-emerald-600">PKR {formatPKR(group.paid)}</span></span>
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-slate-50 border-t border-slate-100 bg-slate-50/40">
                  {group.items.map(d => (
                    <div key={d.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Handshake size={17} className="text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{d.name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-blue-600 font-bold text-sm">PKR {formatPKR(dealTotal(d))}</span>
                          {isSupervisor && (
                            <div className="flex gap-2">
                              <button onClick={() => openAddScope(d)} className="text-slate-400 active:text-blue-600" title="Add scope" aria-label="Add scope"><Plus size={15} /></button>
                              <button onClick={() => { setEditing(d); setSheetOpen(true) }} className="text-slate-400 active:text-blue-600"><Pencil size={14} /></button>
                              <button onClick={() => handleDelete(d.id)} className="text-slate-400 active:text-red-600"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 ml-12 space-y-1">
                        {sortedDealRevisions(d).map(revision => (
                          <div key={revision.id} className="flex items-start justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-600 truncate">V{revision.revision_number} · {revision.scope_description}</p>
                              <p className="text-slate-400">{formatDate(revision.date)}{revision.notes ? ` · ${revision.notes}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={cn('font-bold', revision.amount_delta < 0 ? 'text-red-500' : 'text-blue-600')}>
                                {revision.amount_delta > 0 ? '+' : '−'}PKR {formatPKR(Math.abs(revision.amount_delta))}
                              </span>
                              {isSupervisor && (
                                <button onClick={() => openEditRevision(d, revision)} className="text-slate-400 active:text-blue-600" title={`Edit V${revision.revision_number}`} aria-label={`Edit V${revision.revision_number}`}>
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {groupPayments.length > 0 && (
                    <div className="border-t border-slate-100">
                      <button
                        onClick={() => togglePayments(groupKey)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                      >
                        <span className="flex items-center gap-1.5">
                          <Receipt size={13} />
                          Payments ({groupPayments.length})
                        </span>
                        <ChevronDown size={12} className={cn('transition-transform', isPaymentsExpanded && 'rotate-180')} />
                      </button>

                      {isPaymentsExpanded && (
                        <div className="divide-y divide-slate-50 pb-1">
                          {groupPayments.map(e => {
                            const alloc = e.expense_allocations.find(a => a.part_id === group.partId)
                            return (
                              <div key={e.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                    <Receipt size={13} className="text-emerald-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-700 truncate">{e.description}</p>
                                    <p className="text-[11px] text-slate-400">{formatDate(e.date)}{e.notes ? ` · ${e.notes}` : ''}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-bold text-emerald-600 flex-shrink-0">
                                  PKR {formatPKR(alloc?.amount ?? 0)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
        existingDeals={deals}
        onAddScope={openAddScope}
      />
      <DealRevisionSheet
        open={!!revisionDeal}
        deal={revisionDeal}
        editingRevision={editingRevision}
        onClose={() => { setRevisionDeal(null); setEditingRevision(null) }}
        onSaved={handleRevisionSaved}
      />
    </div>
  )
}
