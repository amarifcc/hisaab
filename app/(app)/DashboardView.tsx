'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, ArrowDownLeft, TrendingDown, ChevronDown, ChevronUp, Lock, Clock } from 'lucide-react'
import { formatPKR, formatDate, cn } from '@/lib/utils'
import ExpenseSheet from '@/components/ExpenseSheet'
import type { ProjectPart, Category } from '@/lib/types'

type AnyTransfer = Record<string, any>
type AnyExpense = Record<string, any>
type AnyAllocation = { part_id: string; amount: number }

interface Props {
  parts: ProjectPart[]
  transfers: AnyTransfer[]
  expenses: AnyExpense[]
  allocations: AnyAllocation[]
  isSupervisor: boolean
}

const FILTER_KEY = 'hisab_filter_part'

export default function DashboardView({ parts, transfers, expenses, allocations, isSupervisor }: Props) {
  const [filterPart, setFilterPart] = useState<string>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false)
  const [sortByLog, setSortByLog] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [localExpenses, setLocalExpenses] = useState(expenses)
  const [localAllocations, setLocalAllocations] = useState(allocations)
  const filterRef = useRef<HTMLDivElement>(null)

  // Restore filter from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(FILTER_KEY)
    if (saved) setFilterPart(saved)
  }, [])

  // Fetch categories for expense sheet
  useEffect(() => {
    fetch('/api/categories-list').then(r => r.json()).then(d => setCategories(d ?? [])).catch(() => {})
  }, [])

  function changeFilter(val: string) {
    setFilterPart(val)
    localStorage.setItem(FILTER_KEY, val)
    setFilterOpen(false)
  }

  // Close filter dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Balance calculations
  const partBalances = parts.map(part => {
    const deposited = transfers.filter(t => t.part_id === part.id).reduce((s, t) => s + t.amount, 0)
    const spent = localAllocations.filter(a => a.part_id === part.id).reduce((s, a) => s + a.amount, 0)
    return { part, deposited, spent, balance: deposited - spent }
  })

  const shownPart = filterPart === 'all' ? null : parts.find(p => p.id === filterPart)

  const summaryDeposited = filterPart === 'all'
    ? partBalances.reduce((s, p) => s + p.deposited, 0)
    : (partBalances.find(p => p.part.id === filterPart)?.deposited ?? 0)

  const summarySpent = filterPart === 'all'
    ? partBalances.reduce((s, p) => s + p.spent, 0)
    : (partBalances.find(p => p.part.id === filterPart)?.spent ?? 0)

  const summaryBalance = summaryDeposited - summarySpent

  // Filtered recent activity
  const filteredTransfers = (filterPart === 'all'
    ? transfers
    : transfers.filter(t => t.part_id === filterPart)
  ).map(t => ({ _type: 'transfer' as const, _date: t.date, _created: t.created_at, ...t }))

  const filteredExpenses = (filterPart === 'all'
    ? localExpenses
    : localExpenses.filter(e => e.expense_allocations?.some((a: AnyAllocation) => a.part_id === filterPart))
  ).map(e => ({ _type: 'expense' as const, _date: e.date, _created: e.created_at, ...e }))

  const recent = [...filteredTransfers, ...filteredExpenses]
    .sort((a, b) => {
      const av = sortByLog ? a._created : a._date
      const bv = sortByLog ? b._created : b._date
      return bv.localeCompare(av)
    })

  const filterLabel = filterPart === 'all' ? 'All Parts' : (shownPart?.name ?? 'All Parts')

  const [expandedId, setExpandedId] = useState<string | null>(null)
  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function handleSaved(data: any) {
    if (!data) return
    setLocalExpenses(prev => [data, ...prev])
    const newAllocs = (data.expense_allocations ?? []).map((a: any) => ({ part_id: a.part_id, amount: a.amount }))
    setLocalAllocations(prev => [...prev, ...newAllocs])
  }

  return (
    <div className="px-4 pt-4 pb-28">

      {/* Filter dropdown */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen(o => !o)}
            className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
          >
            {shownPart && (
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: shownPart.color }} />
            )}
            {filterLabel}
            <ChevronDown size={14} className={cn('transition-transform', filterOpen && 'rotate-180')} />
          </button>

          {filterOpen && (
            <div className="absolute top-full left-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[160px] overflow-hidden">
              <button
                onClick={() => changeFilter('all')}
                className={cn('w-full text-left px-4 py-3 text-sm font-medium transition-colors',
                  filterPart === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')}
              >
                All Parts
              </button>
              {parts.map(p => (
                <button
                  key={p.id}
                  onClick={() => changeFilter(p.id)}
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
      </div>

      {/* Main balance card */}
      <div
        className="rounded-2xl p-5 mb-4 text-white"
        style={{ background: summaryBalance < 0 ? '#dc2626' : (shownPart ? shownPart.color : '#1e40af') }}
      >
        <p className="text-xs font-medium opacity-75 uppercase tracking-wide mb-1">
          {filterPart === 'all' ? 'Total with Supervisor' : `${shownPart?.name} Balance`}
        </p>
        <p className="text-3xl font-bold tracking-tight">
          {summaryBalance < 0 ? '−' : ''}PKR {formatPKR(Math.abs(summaryBalance))}
        </p>
        {summaryBalance < 0 && (
          <p className="text-xs font-semibold opacity-90 mt-0.5">Deficit — expenses exceed deposits</p>
        )}
        <div className="flex gap-4 mt-3 text-xs opacity-80">
          <span>↓ {formatPKR(summaryDeposited)} deposited</span>
          <span>↑ {formatPKR(summarySpent)} spent</span>
        </div>
      </div>

      {/* Per-part cards — only in "All" view */}
      {filterPart === 'all' && parts.length > 0 && (
        <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${Math.min(parts.length, 2)}, 1fr)` }}>
          {partBalances.map(({ part, deposited, spent, balance }) => (
            <button
              key={part.id}
              onClick={() => changeFilter(part.id)}
              className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm text-left active:bg-slate-50"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: part.color }} />
                <span className="text-xs font-semibold text-slate-700">{part.short_name}</span>
              </div>
              <p className={cn('text-base font-bold', balance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {balance < 0 ? '−' : ''}PKR {formatPKR(Math.abs(balance))}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {formatPKR(deposited)} in · {formatPKR(spent)} out
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700">
            Recent Activity
            {shownPart && <span className="ml-1.5 text-xs font-normal text-slate-400">· {shownPart.name}</span>}
          </h2>
          <button
            onClick={() => setSortByLog(s => !s)}
            title={sortByLog ? 'Sorted by log date — tap for occurrence date' : 'Sorted by occurrence date — tap for log date'}
            className={cn('p-1.5 rounded-lg border transition-colors', sortByLog ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400')}
          >
            <Clock size={13} />
          </button>
        </div>

        {recent.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">No entries yet</p>
            {isSupervisor && <p className="text-xs mt-1">Tap + to add the first one</p>}
          </div>
        )}

        <div className="space-y-2">
          {recent.map(item => {
            const itemId = (item as any).id
            const isExpanded = expandedId === itemId

            if (item._type === 'transfer') {
              const t = item as any
              const part = t.project_parts
              return (
                <div key={itemId} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => toggleExpand(itemId)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <ArrowDownLeft size={17} className="text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {part && (
                            <span className="text-xs font-medium text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: part.color }}>
                              {part.short_name}
                            </span>
                          )}
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Transfer</span>
                          {t.from_person && (
                            <span className="text-sm text-slate-700 font-medium">{t.from_person}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(t.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-emerald-600 font-bold text-sm">+{formatPKR(t.amount)}</span>
                      {isExpanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50">
                      <div className="space-y-1 text-xs text-slate-500">
                        {part && <p><span className="text-slate-400">Part:</span> {part.name}</p>}
                        {t.from_person && <p><span className="text-slate-400">From:</span> {t.from_person}</p>}
                        <p><span className="text-slate-400">Amount:</span> PKR {formatPKR(t.amount)}</p>
                        <p><span className="text-slate-400">Date:</span> {formatDate(t.date)}</p>
                        {t.notes && <p><span className="text-slate-400">Notes:</span> {t.notes}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )
            } else {
              const e = item as any
              const cat = e.categories
              const allocs: AnyAllocation[] = e.expense_allocations ?? []
              const displayAllocs = filterPart === 'all'
                ? allocs
                : allocs.filter((a: AnyAllocation) => a.part_id === filterPart)

              return (
                <div key={itemId} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => toggleExpand(itemId)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                        <TrendingDown size={17} className="text-rose-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{e.description}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {displayAllocs.map((a: any) => (
                            <span key={a.part_id} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: a.project_parts?.color }}>
                              {a.project_parts?.short_name}
                            </span>
                          ))}
                          {cat && (
                            <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: cat.color }}>
                              {cat.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDate(e.date)}{e.paid_to ? ` · ${e.paid_to}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-rose-500 font-bold text-sm">
                        -{formatPKR(filterPart === 'all'
                          ? e.total_amount
                          : (allocs.find((a: AnyAllocation) => a.part_id === filterPart)?.amount ?? e.total_amount))}
                      </span>
                      {isExpanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50">
                      <div className="space-y-1 text-xs text-slate-500">
                        {e.description && <p><span className="text-slate-400">Description:</span> {e.description}</p>}
                        {cat && <p><span className="text-slate-400">Category:</span> {cat.name}</p>}
                        {e.paid_to && <p><span className="text-slate-400">Paid to:</span> {e.paid_to}</p>}
                        <p><span className="text-slate-400">Date:</span> {formatDate(e.date)}</p>
                        {allocs.length > 0 && (
                          <div>
                            <span className="text-slate-400">Split: </span>
                            {allocs.map((a: any) => (
                              <span key={a.part_id} className="mr-2">
                                {a.project_parts?.short_name}
                              </span>
                            ))}
                          </div>
                        )}
                        {e.notes && <p><span className="text-slate-400">Notes:</span> {e.notes}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )
            }
          })}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-5 z-40">
        {isSupervisor ? (
          <button
            onClick={() => setExpenseSheetOpen(true)}
            className="w-14 h-14 rounded-full bg-blue-700 flex items-center justify-center shadow-lg active:bg-blue-800"
          >
            <Plus size={24} className="text-white" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 bg-slate-200 rounded-full px-4 py-2.5">
            <Lock size={13} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-400">Read only</span>
          </div>
        )}
      </div>

      <ExpenseSheet
        open={expenseSheetOpen}
        onClose={() => setExpenseSheetOpen(false)}
        onSaved={handleSaved}
        parts={parts}
        categories={categories}
        editing={null}
      />
    </div>
  )
}
