'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  ArrowDownToLine,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  List,
  Receipt,
  Search,
  SlidersHorizontal,
  Tag,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import InfoTooltip from '@/components/InfoTooltip'
import NotesList from '@/components/NotesList'
import ShareMeter from '@/components/ShareMeter'
import { formatPKR, amountHint, cn, formatDate } from '@/lib/utils'
import type { ProjectPart, Category, ExpenseWithDetails } from '@/lib/types'

interface Props {
  parts: ProjectPart[]
  categories: Category[]
  expenses: ExpenseWithDetails[]
  transfers: { part_id: string; amount: number }[]
  title?: string
  subtitle?: string
  ownerView?: boolean
  ownerPartId?: string | null
}

type ReportView = 'overview' | 'expenses' | 'categories'
type SourceFilter = 'all' | 'supervisor' | 'owner'
type CatSlice = { id: string; name: string; color: string; amount: number; owner: number; count: number; expenses: ExpenseWithDetails[] }
type PartSummary = {
  part: ProjectPart
  received: number
  supervisor: number
  owner: number
  total: number
  balance: number
  categories: CatSlice[]
  expenseCount: number
}
type ExpenseDisplayRow = {
  id: string
  expense: ExpenseWithDetails
  allocation?: ExpenseWithDetails['expense_allocations'][number]
  amount: number
  allocationIndex: number
  allocationCount: number
}

const PART_FILTER_KEY = 'hisab_reports_filter_part'
const PART_FILTER_CHANGE_EVENT = 'hisab_reports_filter_part_change'
const SOURCE_FILTERS = [
  { id: 'all' as const, label: 'Both Sources', shortLabel: 'Both' },
  { id: 'supervisor' as const, label: 'Supervisor', shortLabel: 'Supervisor' },
  { id: 'owner' as const, label: 'Owner-direct', shortLabel: 'Owner' },
]

function getStoredPartFilter(defaultValue: string) {
  if (typeof window === 'undefined') return defaultValue
  return localStorage.getItem(PART_FILTER_KEY) || defaultValue
}

function subscribePartFilter(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(PART_FILTER_CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(PART_FILTER_CHANGE_EVENT, onStoreChange)
  }
}

function compact(amount: number) {
  return amountHint(amount) || formatPKR(amount)
}

function setLabel<T extends string>(items: Set<T>, noun: string, options: { id: T; label: string }[]) {
  if (items.size === 0) return `All ${noun}`
  if (items.size === 1) return options.find(o => items.has(o.id))?.label ?? '1 selected'
  return `${items.size} ${noun} selected`
}

function sourceContextLabel(sourceFilter: SourceFilter) {
  if (sourceFilter === 'supervisor') return 'Supervisor'
  if (sourceFilter === 'owner') return 'Owner-direct'
  return 'Both sources'
}

export default function CombinedReportView({
  parts,
  categories,
  expenses,
  transfers,
  title = 'Joint Home',
  subtitle,
  ownerView = false,
  ownerPartId,
}: Props) {
  const [view, setView] = useState<ReportView>('overview')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const defaultPartFilter = ownerView && ownerPartId ? ownerPartId : 'all'
  const filterPart = useSyncExternalStore(
    subscribePartFilter,
    () => getStoredPartFilter(defaultPartFilter),
    () => defaultPartFilter
  )
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function changePartFilter(val: string) {
    localStorage.setItem(PART_FILTER_KEY, val)
    window.dispatchEvent(new Event(PART_FILTER_CHANGE_EVENT))
    setDropdownOpen(false)
  }

  const selectedPart = parts.find(p => p.id === filterPart)
  const visibleParts = useMemo(() => selectedPart ? [selectedPart] : parts, [selectedPart, parts])

  const scopedExpenses = useMemo(() => expenses.filter(e =>
    (sourceFilter === 'all' || e.source === sourceFilter) &&
    (!selectedPart || (e.expense_allocations ?? []).some(a => a.part_id === selectedPart.id))
  ), [expenses, selectedPart, sourceFilter])

  const scopedTransfers = useMemo(() => (
    transfers.filter(t => !selectedPart || t.part_id === selectedPart.id)
  ), [transfers, selectedPart])

  const summaries = useMemo<PartSummary[]>(() => {
    return visibleParts.map(part => {
      const received = scopedTransfers.filter(t => t.part_id === part.id).reduce((s, t) => s + Number(t.amount), 0)
      let supervisor = 0
      let owner = 0
      const catMap = new Map<string, CatSlice>()

      for (const e of scopedExpenses) {
        const partAmount = (e.expense_allocations ?? [])
          .filter(a => a.part_id === part.id)
          .reduce((s, a) => s + Number(a.amount), 0)
        if (partAmount === 0) continue

        const isOwner = e.source === 'owner'
        if (isOwner) owner += partAmount
        else supervisor += partAmount

        const id = e.category_id ?? '__none__'
        const category = categories.find(c => c.id === id)
        const slice = catMap.get(id) ?? {
          id,
          name: category?.name ?? 'Uncategorized',
          color: category?.color ?? '#94a3b8',
          amount: 0,
          owner: 0,
          count: 0,
          expenses: [],
        }
        slice.amount += partAmount
        if (isOwner) slice.owner += partAmount
        slice.count += 1
        slice.expenses.push(e)
        catMap.set(id, slice)
      }

      const cats = [...catMap.values()].sort((a, b) => b.amount - a.amount)
      return {
        part,
        received,
        supervisor,
        owner,
        total: supervisor + owner,
        balance: received - supervisor,
        categories: cats,
        expenseCount: cats.reduce((s, c) => s + c.count, 0),
      }
    })
  }, [visibleParts, scopedExpenses, scopedTransfers, categories])

  const grand = useMemo(() => summaries.reduce(
    (a, s) => ({
      received: a.received + s.received,
      supervisor: a.supervisor + s.supervisor,
      owner: a.owner + s.owner,
      total: a.total + s.total,
      balance: a.balance + s.balance,
      expenseCount: a.expenseCount + s.expenseCount,
    }),
    { received: 0, supervisor: 0, owner: 0, total: 0, balance: 0, expenseCount: 0 }
  ), [summaries])

  const categoryRollup = useMemo<CatSlice[]>(() => {
    const map = new Map<string, CatSlice>()
    for (const s of summaries) {
      for (const c of s.categories) {
        const cur = map.get(c.id) ?? { id: c.id, name: c.name, color: c.color, amount: 0, owner: 0, count: 0, expenses: [] }
        cur.amount += c.amount
        cur.owner += c.owner
        cur.count += c.count
        cur.expenses.push(...c.expenses)
        map.set(c.id, cur)
      }
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount)
  }, [summaries])

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Wallet },
    { id: 'expenses' as const, label: 'Expenses', icon: List },
    { id: 'categories' as const, label: 'Categories', icon: Tag },
  ]

  return (
    <div className="px-4 pt-5 pb-24">
      <div className="mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 truncate">{title}</h1>
            <InfoTooltip
              label="Joint Home info"
              text="View-only combined totals: supervisor spend plus owner-direct spend. Use source and part filters to change report scope. Make changes in the source workspace."
            />
          </div>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SourceFilterDropdown value={sourceFilter} onChange={setSourceFilter} />

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm border transition-colors max-w-[190px]',
                dropdownOpen ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-100' : 'bg-white border-blue-100 text-slate-800'
              )}
            >
              <SlidersHorizontal size={14} className="text-blue-600 flex-shrink-0" />
              {selectedPart && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedPart.color }} />}
              <span className="truncate">{selectedPart ? selectedPart.name : 'All Parts'}</span>
              <ChevronDown size={13} className={cn('transition-transform text-blue-600 flex-shrink-0', dropdownOpen && 'rotate-180')} />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[190px] overflow-hidden">
                <button onClick={() => changePartFilter('all')}
                  className={cn('w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors',
                    filterPart === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')}>
                  All Parts
                  {filterPart === 'all' && <Check size={14} className="text-blue-600" />}
                </button>
                {parts.map(p => (
                  <button key={p.id} onClick={() => changePartFilter(p.id)}
                    className={cn('w-full text-left px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors',
                      filterPart === p.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="flex-1 truncate">{p.name}</span>
                    {filterPart === p.id && <Check size={14} className="text-blue-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 bg-slate-100 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              view === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            )}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {view === 'overview' && (
          <OverviewReport
            summaries={summaries}
            grand={grand}
            selectedPart={selectedPart}
            sourceFilter={sourceFilter}
            ownerView={ownerView}
            ownerPartId={ownerPartId ?? null}
          />
        )}
        {view === 'expenses' && (
          <CombinedExpensesList
            expenses={scopedExpenses}
            selectedPart={selectedPart}
            sourceFilter={sourceFilter}
          />
        )}
        {view === 'categories' && (
          <CategoryReport
            categories={categoryRollup}
            total={grand.total}
            selectedPart={selectedPart}
            sourceFilter={sourceFilter}
            ownerView={ownerView}
            ownerPartId={ownerPartId ?? null}
          />
        )}
      </div>
    </div>
  )
}

function SourceFilterDropdown({ value, onChange }: {
  value: SourceFilter
  onChange: (value: SourceFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = SOURCE_FILTERS.find(item => item.id === value) ?? SOURCE_FILTERS[0]

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm border transition-colors max-w-[180px]',
          open ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-100' : 'bg-white border-blue-100 text-slate-800'
        )}
      >
        <Receipt size={14} className="text-blue-600 flex-shrink-0" />
        <span className="truncate">{selected.shortLabel}</span>
        <ChevronDown size={13} className={cn('transition-transform text-blue-600 flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[180px] overflow-hidden">
          {SOURCE_FILTERS.map(item => (
            <button
              key={item.id}
              onClick={() => {
                onChange(item.id)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition-colors',
                value === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <span className="truncate">{item.label}</span>
              {value === item.id && <Check size={14} className="text-blue-600 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function OverviewReport({ summaries, grand, selectedPart, sourceFilter, ownerView, ownerPartId }: {
  summaries: PartSummary[]
  grand: { received: number; supervisor: number; owner: number; total: number; balance: number; expenseCount: number }
  selectedPart?: ProjectPart
  sourceFilter: SourceFilter
  ownerView: boolean
  ownerPartId: string | null
}) {
  const costLabel = sourceFilter === 'all' ? 'Total' : sourceContextLabel(sourceFilter)
  const heroLabel = selectedPart
    ? `${costLabel} cost · ${selectedPart.name}`
    : `${costLabel} cost · all parts`
  const heroColor = selectedPart?.color
  const supervisorPct = grand.total > 0 ? Math.round((grand.supervisor / grand.total) * 100) : 0
  const ownerPct = grand.total > 0 ? Math.round((grand.owner / grand.total) * 100) : 0
  const showSourceSplit = sourceFilter === 'all'
  const showFunding = sourceFilter !== 'owner'
  const ownPart = selectedPart && ownerView && selectedPart.id === ownerPartId

  return (
    <div className="space-y-2.5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-4" style={heroColor ? { borderLeft: `3px solid ${heroColor}` } : undefined}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">{heroLabel}</p>
              <p className="text-3xl font-bold mt-1 text-slate-900">PKR {formatPKR(grand.total)}</p>
              <p className="text-xs text-slate-400 mt-1">
                {grand.expenseCount} txn
                {showSourceSplit && <> · Supervisor {supervisorPct}% · owner-direct {ownerPct}%</>}
              </p>
            </div>
            {showFunding && (
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold flex-shrink-0',
                grand.balance < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              )}>
                {grand.balance < 0 ? 'Deficit' : 'Funded'}
              </span>
            )}
          </div>
          {showSourceSplit && <SplitMeter supervisor={grand.supervisor} owner={grand.owner} />}
        </div>
        <div className={cn('grid gap-2 px-4 pb-4', showSourceSplit ? 'grid-cols-2' : 'grid-cols-1')}>
          {sourceFilter !== 'owner' && <SourceStat label="Supervisor spent" amount={grand.supervisor} percent={showSourceSplit ? supervisorPct : 100} className="bg-rose-50 text-rose-600" />}
          {sourceFilter !== 'supervisor' && <SourceStat label={ownPart ? 'Your direct spend' : 'Owner-direct'} amount={grand.owner} percent={showSourceSplit ? ownerPct : 100} className="bg-amber-50 text-amber-600" />}
        </div>
      </div>

      {showFunding && (
        <FundingStatusPanel
          grand={grand}
          ownPart={Boolean(ownPart)}
        />
      )}

      {!selectedPart && summaries.length > 1 && (
        <PartsBreakdownPanel summaries={summaries} sourceFilter={sourceFilter} ownerView={ownerView} ownerPartId={ownerPartId} />
      )}

      {summaries.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">No project parts found.</p>
      )}
    </div>
  )
}

function FundingStatusPanel({ grand, ownPart }: {
  grand: { received: number; supervisor: number; owner: number; total: number; balance: number; expenseCount: number }
  ownPart: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-bold text-slate-900">Funding status</p>
        <span className={cn(
          'text-[11px] font-semibold rounded-full px-2 py-1',
          grand.balance < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
        )}>
          {grand.balance < 0 ? 'Deficit' : 'Funded'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label={ownPart ? 'You gave supervisor' : 'Received'} value={grand.received} tone="green" compact />
        <Stat label={ownPart ? 'Unspent' : 'Balance'} value={grand.balance} danger={grand.balance < 0} compact />
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        Supervisor spent PKR {formatPKR(grand.supervisor)} from received funds.
      </p>
    </div>
  )
}

function SourceStat({ label, amount, percent, className }: {
  label: string
  amount: number
  percent: number
  className: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-400 truncate">{label}</p>
        <span className={cn('text-[11px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0', className)}>
          {percent}%
        </span>
      </div>
      <p className="text-sm font-bold mt-1 text-slate-900 truncate">PKR {formatPKR(amount)}</p>
    </div>
  )
}

function PartsBreakdownPanel({ summaries, sourceFilter, ownerView, ownerPartId }: {
  summaries: PartSummary[]
  sourceFilter: SourceFilter
  ownerView: boolean
  ownerPartId: string | null
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-bold text-slate-900">By part</p>
        <span className="text-[11px] text-slate-400">{summaries.length} parts</span>
      </div>
      <div className="space-y-2">
        {[...summaries].sort((a, b) => b.total - a.total).map(summary => (
          <PartBreakdownRow
            key={summary.part.id}
            summary={summary}
            sourceFilter={sourceFilter}
            ownerLabel={ownerView && summary.part.id === ownerPartId ? 'you' : 'owner'}
          />
        ))}
      </div>
    </div>
  )
}

function PartBreakdownRow({ summary, sourceFilter, ownerLabel }: {
  summary: PartSummary
  sourceFilter: SourceFilter
  ownerLabel: string
}) {
  const supervisorPct = summary.total > 0 ? Math.round((summary.supervisor / summary.total) * 100) : 0
  const ownerPct = summary.total > 0 ? Math.round((summary.owner / summary.total) * 100) : 0
  const showSplit = sourceFilter === 'all'

  return (
    <div className="rounded-xl border border-slate-100 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: summary.part.color }} />
          <span className="text-xs font-semibold text-slate-700 truncate">{summary.part.name}</span>
        </div>
        <span className="text-xs font-bold text-slate-900 flex-shrink-0">PKR {formatPKR(summary.total)}</span>
      </div>
      {showSplit ? (
        <>
          <SplitMeter supervisor={summary.supervisor} owner={summary.owner} compact />
          <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] text-slate-400">
            <span>supervisor {compact(summary.supervisor)} · {supervisorPct}%</span>
            <span>{ownerLabel} {compact(summary.owner)} · {ownerPct}%</span>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-slate-400">{summary.expenseCount} txn</p>
      )}
    </div>
  )
}

function CombinedExpensesList({ expenses, selectedPart, sourceFilter }: {
  expenses: ExpenseWithDetails[]
  selectedPart?: ProjectPart
  sourceFilter: SourceFilter
}) {
  const [search, setSearch] = useState('')
  const [sortByLog, setSortByLog] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set())
  const q = search.trim().toLowerCase()

  const allRows = getExpenseDisplayRows(expenses, selectedPart)
  const categoryOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; color?: string }>()
    for (const row of allRows) {
      const id = row.expense.category_id ?? '__none__'
      if (!map.has(id)) {
        map.set(id, {
          id,
          label: row.expense.categories?.name ?? 'Uncategorized',
          color: row.expense.categories?.color ?? '#94a3b8',
        })
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [allRows])

  const personOptions = useMemo(() => {
    const names = new Set<string>()
    for (const row of allRows) names.add(row.expense.paid_to || '(unspecified)')
    return [...names].sort((a, b) => a.localeCompare(b)).map(name => ({ id: name, label: name }))
  }, [allRows])

  function toggleCategory(id: string) {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePerson(id: string) {
    setSelectedPeople(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rows = allRows
    .filter(row => {
      if (selectedCategories.size > 0 && !selectedCategories.has(row.expense.category_id ?? '__none__')) return false
      if (selectedPeople.size > 0 && !selectedPeople.has(row.expense.paid_to || '(unspecified)')) return false
      if (!q) return true
      const e = row.expense
      return (
        (e.description ?? '').toLowerCase().includes(q) ||
        (e.paid_to ?? '').toLowerCase().includes(q) ||
        (e.categories?.name ?? '').toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const av = sortByLog ? a.expense.created_at : a.expense.date
      const bv = sortByLog ? b.expense.created_at : b.expense.date
      return bv.localeCompare(av)
    })

  const total = rows.reduce((s, r) => s + r.amount, 0)
  const ownerTotal = rows.filter(r => r.expense.source === 'owner').reduce((s, r) => s + r.amount, 0)
  const activeFilterCount = selectedCategories.size + selectedPeople.size
  const heading = sourceFilter === 'all' ? 'Combined Expenses' : `${sourceContextLabel(sourceFilter)} Expenses`
  const sourceSummary = sourceFilter === 'supervisor'
    ? `supervisor PKR ${formatPKR(total)}`
    : `owner-direct PKR ${formatPKR(ownerTotal)}`

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search description, person, category…"
            className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        <button
          onClick={() => setSortByLog(s => !s)}
          title={`Sorted by ${sortByLog ? 'log entry date' : 'transaction date'}`}
          className={cn(
            'p-2 rounded-xl border transition-colors flex-shrink-0',
            sortByLog ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500'
          )}
        >
          <CalendarDays size={14} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        <MultiSelectFilter
          noun="Categories"
          options={categoryOptions}
          selected={selectedCategories}
          onToggle={toggleCategory}
          onClear={() => setSelectedCategories(new Set())}
        />
        <MultiSelectFilter
          noun="People"
          options={personOptions}
          selected={selectedPeople}
          onToggle={togglePerson}
          onClear={() => setSelectedPeople(new Set())}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
        <p className="text-xs text-slate-400 font-medium">{search ? `Matching "${search}"` : activeFilterCount > 0 ? `Filtered ${heading}` : heading}</p>
        <p className="text-lg font-bold mt-0.5 text-slate-900">PKR {formatPKR(total)}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'} · {sourceSummary} · by {sortByLog ? 'log entry date' : 'transaction date'}
        </p>
      </div>

      {rows.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">{search ? 'No results' : 'No expenses recorded'}</p>
      )}

      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {rows.map((row, i) => {
            const isExpanded = expandedId === row.id
            return (
              <div key={row.id} className={cn(i > 0 && 'border-t border-slate-100')}>
                <button
                  onClick={() => setExpandedId(prev => prev === row.id ? null : row.id)}
                  className="w-full px-4 py-3 flex items-start justify-between text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <ExpenseParts row={row} />
                      <SourceBadge source={row.expense.source} />
                      <LinkedExpenseTag row={row} />
                      <p className="text-sm font-medium text-slate-800 truncate">{row.expense.description || row.expense.categories?.name || 'Expense'}</p>
                    </div>
                    <ExpenseMeta expense={row.expense} />
                    <NotesList notes={row.expense.notes} />
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-bold', row.expense.source === 'owner' ? 'text-amber-600' : 'text-rose-500')}>
                        PKR {formatPKR(row.amount)}
                      </span>
                      {isExpanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 pt-2 border-t border-slate-100 bg-slate-50">
                    <div className="space-y-1 text-xs text-slate-500 mb-3">
                      {row.expense.description && <p><span className="text-slate-400">Description:</span> {row.expense.description}</p>}
                      {row.expense.categories && <p><span className="text-slate-400">Category:</span> {row.expense.categories.name}</p>}
                      {row.expense.paid_to && <p><span className="text-slate-400">Paid to:</span> {row.expense.paid_to}</p>}
                      <p><span className="text-slate-400">Source:</span> {row.expense.source === 'owner' ? 'Owner-direct' : 'Supervisor'}</p>
                      <p><span className="text-slate-400">Date:</span> {formatDate(row.expense.date)}</p>
                      {row.expense.notes && <p><span className="text-slate-400">Notes:</span> {row.expense.notes}</p>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CategoryReport({ categories, total, selectedPart, sourceFilter, ownerView, ownerPartId }: {
  categories: CatSlice[]
  total: number
  selectedPart?: ProjectPart
  sourceFilter: SourceFilter
  ownerView: boolean
  ownerPartId: string | null
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const ownPart = selectedPart && ownerView && selectedPart.id === ownerPartId

  return (
    <div className="space-y-2.5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
        <p className="text-xs text-slate-400 font-medium">
          {sourceContextLabel(sourceFilter)} · {selectedPart ? selectedPart.name : 'All Parts'}
        </p>
        <p className="text-lg font-bold mt-0.5 text-slate-900">PKR {formatPKR(total)}</p>
        <p className="text-xs text-slate-400 mt-0.5">{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</p>
      </div>

      {categories.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">No expenses recorded</p>
      )}

      {categories.map(c => {
        const expanded = expandedId === c.id
        return (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button className="w-full px-4 py-3.5 text-left" onClick={() => setExpandedId(prev => prev === c.id ? null : c.id)}>
              <CategoryRow category={c} total={total} ownerLabel={ownPart ? 'you' : 'owner'} />
            </button>
            {expanded && (
              <div className="border-t border-slate-100">
                {getExpenseDisplayRows(c.expenses, selectedPart).slice(0, 12).map((row, i) => (
                  <div key={row.id} className={cn('flex items-start justify-between px-4 py-2.5', i > 0 && 'border-t border-slate-50')}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ExpenseParts row={row} />
                        <SourceBadge source={row.expense.source} />
                        <p className="text-xs font-medium text-slate-700 truncate">{row.expense.description || c.name}</p>
                      </div>
                      <ExpenseMeta expense={row.expense} showCategory={false} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 flex-shrink-0 ml-2">PKR {formatPKR(row.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CategoryRow({ category, total, ownerLabel }: { category: CatSlice; total: number; ownerLabel: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
          <span className="text-slate-600 truncate">{category.name}</span>
          <span className="text-slate-400 flex-shrink-0">{category.count} txn</span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          {category.owner > 0 && <span className="text-[11px] text-slate-400">{ownerLabel} {compact(category.owner)}</span>}
          <span className="text-slate-500 font-medium">PKR {formatPKR(category.amount)}</span>
        </span>
      </div>
      <ShareMeter percent={total > 0 ? (category.amount / total) * 100 : 0} color={category.color} className="" />
    </div>
  )
}

function MultiSelectFilter({ noun, options, selected, onToggle, onClear }: {
  noun: string
  options: { id: string; label: string; color?: string }[]
  selected: Set<string>
  onToggle: (id: string) => void
  onClear: () => void
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
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
      >
        {selected.size > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
        <span className="truncate max-w-[180px]">{setLabel(selected, noun, options)}</span>
        <ChevronDown size={13} className={cn('flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[210px] max-h-60 overflow-y-auto">
          <button
            onClick={() => { onClear(); setOpen(false) }}
            className={cn('w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors',
              selected.size === 0 ? 'text-blue-700 bg-blue-50' : 'text-slate-700 hover:bg-slate-50')}
          >
            All {noun}
            {selected.size === 0 && <Check size={14} className="text-blue-600" />}
          </button>
          {options.map(o => (
            <button
              key={o.id}
              onClick={() => onToggle(o.id)}
              className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                selected.has(o.id) ? 'bg-blue-50' : 'hover:bg-slate-50')}
            >
              {o.color
                ? <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />
                : <span className="w-2.5 h-2.5 rounded-full bg-slate-300 flex-shrink-0" />}
              <span className={cn('flex-1 text-left truncate', selected.has(o.id) ? 'text-blue-700 font-medium' : 'text-slate-700')}>
                {o.label}
              </span>
              {selected.has(o.id) && <Check size={14} className="text-blue-600 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, danger = false, tone, compact = false }: {
  label: string
  value: number
  danger?: boolean
  tone?: 'green' | 'rose' | 'blue'
  compact?: boolean
}) {
  const color = danger ? 'text-red-500' : tone === 'green' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-500' : tone === 'blue' ? 'text-blue-600' : 'text-slate-800'
  return (
    <div className={cn('rounded-xl bg-slate-50 px-3', compact ? 'py-2' : 'py-2.5')}>
      <p className="text-[11px] text-slate-400 truncate">{label}</p>
      <p className={cn('text-sm font-bold mt-0.5 truncate', color)}>
        {value < 0 ? '-' : ''}PKR {formatPKR(Math.abs(value))}
      </p>
    </div>
  )
}

function SplitMeter({ supervisor, owner, compact = false }: { supervisor: number; owner: number; compact?: boolean }) {
  const total = supervisor + owner
  const supPct = total > 0 ? (supervisor / total) * 100 : 0
  const ownPct = total > 0 ? (owner / total) * 100 : 0
  return (
    <div className={cn('rounded-full overflow-hidden flex bg-slate-100', compact ? 'h-1.5 mt-2' : 'h-2 mt-3')}>
      <div className="h-full bg-rose-500" style={{ width: `${supPct}%` }} />
      <div className="h-full bg-amber-500" style={{ width: `${ownPct}%` }} />
    </div>
  )
}

function getExpenseDisplayRows(expenses: ExpenseWithDetails[], selectedPart?: ProjectPart): ExpenseDisplayRow[] {
  return expenses.flatMap(expense => {
    const allocations = expense.expense_allocations ?? []
    const visibleAllocations = selectedPart
      ? allocations.filter(allocation => allocation.part_id === selectedPart.id)
      : allocations

    if (selectedPart && visibleAllocations.length === 0) return []
    if (allocations.length <= 1) {
      const allocation = visibleAllocations[0] ?? allocations[0]
      return [{
        id: expense.id,
        expense,
        allocation,
        amount: Number(allocation?.amount ?? expense.total_amount),
        allocationIndex: allocation ? allocations.findIndex(item => item.part_id === allocation.part_id) + 1 : 0,
        allocationCount: allocations.length,
      }]
    }

    return visibleAllocations.map(allocation => ({
      id: `${expense.id}-${allocation.part_id}`,
      expense,
      allocation,
      amount: Number(allocation.amount),
      allocationIndex: allocations.findIndex(item => item.part_id === allocation.part_id) + 1,
      allocationCount: allocations.length,
    }))
  })
}

function ExpenseParts({ row }: { row: ExpenseDisplayRow }) {
  const allocations = row.allocation ? [row.allocation] : row.expense.expense_allocations
  return (
    <>
      {allocations.map(allocation => (
        <span
          key={allocation.part_id}
          className="text-xs px-1.5 py-0.5 rounded text-white flex-shrink-0"
          style={{ backgroundColor: allocation.project_parts?.color }}
        >
          {allocation.project_parts?.short_name}
        </span>
      ))}
    </>
  )
}

function LinkedExpenseTag({ row }: { row: ExpenseDisplayRow }) {
  if (row.allocationCount <= 1) return null
  return (
    <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
      linked {row.allocationIndex} of {row.allocationCount}
    </span>
  )
}

function SourceBadge({ source }: { source: 'supervisor' | 'owner' }) {
  if (source === 'owner') {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded"><Receipt size={10} /> Owner</span>
  }
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded"><ArrowDownToLine size={10} /> Supervisor</span>
}

function ExpenseMeta({ expense, showCategory = true }: {
  expense: ExpenseWithDetails
  showCategory?: boolean
}) {
  return (
    <div className="mt-1.5 space-y-1">
      {showCategory && expense.categories && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: expense.categories.color }}>
            {expense.categories.name}
          </span>
        </div>
      )}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-400">
        {expense.paid_to && (
          <span className="inline-flex items-center gap-1 min-w-0">
            <UserRound size={11} className="flex-shrink-0 text-slate-300" />
            <span className="truncate">{expense.paid_to}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={11} className="flex-shrink-0 text-slate-300" />
          {formatDate(expense.date)}
        </span>
      </div>
    </div>
  )
}
