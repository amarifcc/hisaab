'use client'

import { useState, useRef, useEffect } from 'react'
import { formatPKR, formatDate, cn } from '@/lib/utils'
import { Share2, Users, Tag, Layers, Handshake, ChevronDown, Check } from 'lucide-react'
import type { ProjectPart, Category, Transfer, Expense, ExpenseAllocation, Deal } from '@/lib/types'

type TransferWithPart = Transfer & { project_parts: ProjectPart }
type ExpenseWithDetails = Expense & {
  categories: Category | null
  expense_allocations: (ExpenseAllocation & { project_parts: ProjectPart })[]
}
type DealWithPart = Deal & { project_parts: ProjectPart }
type Tab = 'parts' | 'deals' | 'categories' | 'people'

interface Props {
  parts: ProjectPart[]
  transfers: TransferWithPart[]
  expenses: ExpenseWithDetails[]
  categories: Category[]
  deals: DealWithPart[]
  paidMap: Record<string, Record<string, number>>
}

const PART_FILTER_KEY = 'hisab_reports_filter_part'

export default function ReportsView({ parts, transfers, expenses, categories, deals, paidMap }: Props) {
  const [tab, setTab] = useState<Tab>('parts')
  const [filterPart, setFilterPart] = useState<string>('all')
  useEffect(() => {
    const saved = localStorage.getItem(PART_FILTER_KEY)
    if (saved) setFilterPart(saved)
  }, [])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function changePartFilter(val: string) {
    setFilterPart(val)
    localStorage.setItem(PART_FILTER_KEY, val)
    setDropdownOpen(false)
  }

  const scopedExpenses = expenses.filter(e =>
    filterPart === 'all' || e.expense_allocations.some(a => a.part_id === filterPart)
  )
  const scopedTransfers = transfers.filter(t =>
    filterPart === 'all' || t.part_id === filterPart
  )
  const scopedDeals = deals.filter(d =>
    filterPart === 'all' || d.part_id === filterPart
  )

  function getAmount(e: ExpenseWithDetails): number {
    if (filterPart === 'all') return e.total_amount
    return e.expense_allocations.find(a => a.part_id === filterPart)?.amount ?? 0
  }

  const selectedPart = parts.find(p => p.id === filterPart)

  async function handleShare() {
    setExporting(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      if (!reportRef.current) return
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#f8fafc', logging: false,
      })
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'hisaab-report.png', { type: 'image/png' })
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Hisaab Report' })
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = 'hisaab-report.png'
          document.body.appendChild(a); a.click()
          document.body.removeChild(a); URL.revokeObjectURL(url)
        }
      }, 'image/png')
    } finally {
      setExporting(false)
    }
  }

  const TABS = [
    { id: 'parts' as Tab,      icon: Layers,    label: 'Overview'   },
    { id: 'deals' as Tab,      icon: Handshake, label: 'Deals'      },
    { id: 'categories' as Tab, icon: Tag,        label: 'Works'      },
    { id: 'people' as Tab,     icon: Users,      label: 'People'     },
  ]

  return (
    <div className="px-4 pt-5 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <div className="flex items-center gap-2">
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
                <button onClick={() => changePartFilter('all')}
                  className={cn('w-full text-left px-4 py-3 text-sm font-medium transition-colors',
                    filterPart === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')}>
                  All Parts
                </button>
                {parts.map(p => (
                  <button key={p.id} onClick={() => changePartFilter(p.id)}
                    className={cn('w-full text-left px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors',
                      filterPart === p.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleShare}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            <Share2 size={14} />
            {exporting ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1.5 mb-4 bg-slate-100 p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Report content */}
      <div ref={reportRef} className="space-y-2.5">
        {tab === 'parts' &&
          <PartsReport transfers={scopedTransfers} expenses={scopedExpenses} parts={parts} categories={categories} selectedPart={selectedPart} />}
        {tab === 'deals' &&
          <DealsReport deals={scopedDeals} paidMap={paidMap} filterPart={filterPart} selectedPart={selectedPart} />}
        {tab === 'categories' &&
          <CategoriesReport expenses={scopedExpenses} categories={categories} getAmount={getAmount} selectedPart={selectedPart} />}
        {tab === 'people' &&
          <PeopleReport expenses={scopedExpenses} getAmount={getAmount} selectedPart={selectedPart} />}
        <p className="text-center text-xs text-slate-300 pt-1">Hisaab · {new Date().toLocaleDateString('en-PK')}</p>
      </div>
    </div>
  )
}

// ── Shared summary card ───────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: color ?? '#0f172a' }}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Multi-select filter dropdown ──────────────────────────────────────────────

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

  const label = selected.size === 0
    ? `All ${noun}`
    : selected.size === 1
      ? options.find(o => selected.has(o.id))?.label ?? '1 selected'
      : `${selected.size} ${noun} selected`

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
      >
        {selected.size > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
        )}
        <span className="truncate max-w-[180px]">{label}</span>
        <ChevronDown size={13} className={cn('flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[200px] max-h-60 overflow-y-auto">
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

// ── People Report ─────────────────────────────────────────────────────────────

function PeopleReport({ expenses, getAmount, selectedPart }: {
  expenses: ExpenseWithDetails[]
  getAmount: (e: ExpenseWithDetails) => number
  selectedPart?: ProjectPart
}) {
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set())

  const personMap: Record<string, { total: number; items: ExpenseWithDetails[] }> = {}
  for (const e of expenses) {
    const name = e.paid_to || '(unspecified)'
    if (!personMap[name]) personMap[name] = { total: 0, items: [] }
    personMap[name].total += getAmount(e)
    personMap[name].items.push(e)
  }
  const people = Object.entries(personMap).sort((a, b) => b[1].total - a[1].total)
  const grandTotal = people.reduce((s, [, v]) => s + v.total, 0)

  const personOptions = people.map(([name]) => ({ id: name, label: name }))

  function togglePerson(id: string) {
    setSelectedPeople(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isFiltered = selectedPeople.size > 0
  const visiblePeople = isFiltered ? people.filter(([name]) => selectedPeople.has(name)) : people
  const filteredTotal = visiblePeople.reduce((s, [, v]) => s + v.total, 0)
  const filteredItems = visiblePeople.flatMap(([, v]) => v.items).sort((a, b) => b.date.localeCompare(a.date))

  const subLabel = selectedPart ? selectedPart.name : 'All Parts'

  return (
    <div className="space-y-2.5">
      <MultiSelectFilter
        noun="People"
        options={personOptions}
        selected={selectedPeople}
        onToggle={togglePerson}
        onClear={() => setSelectedPeople(new Set())}
      />

      <SummaryCard
        label={isFiltered ? `Paid to ${selectedPeople.size === 1 ? [...selectedPeople][0] : `${selectedPeople.size} people`}` : 'Total Paid Out'}
        value={`PKR ${formatPKR(filteredTotal)}`}
        sub={isFiltered
          ? `${filteredItems.length} transactions · ${subLabel}`
          : `${people.length} ${people.length === 1 ? 'person' : 'people'} · ${subLabel}`}
      />

      {people.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">No expenses recorded</p>
      )}

      {/* All-people view: expandable summary cards */}
      {!isFiltered && people.map(([name, { total, items }]) => (
        <PersonCard key={name} name={name} total={total} items={items} grandTotal={grandTotal} getAmount={getAmount} />
      ))}

      {/* Filtered view: flat transaction list */}
      {isFiltered && filteredItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredItems.map((e, i) => (
            <div key={e.id} className={cn('flex items-center justify-between px-4 py-3', i > 0 && 'border-t border-slate-100')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  {selectedPeople.size > 1 && e.paid_to && (
                    <span className="text-xs font-semibold text-violet-600">{e.paid_to}</span>
                  )}
                  <p className="text-sm font-medium text-slate-800 truncate">{e.description || e.categories?.name || 'Expense'}</p>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {e.categories && (
                    <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: e.categories.color }}>{e.categories.name}</span>
                  )}
                  {e.expense_allocations.map(a => (
                    <span key={a.part_id} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: a.project_parts?.color }}>{a.project_parts?.short_name}</span>
                  ))}
                  <span className="text-xs text-slate-400">{formatDate(e.date)}</span>
                </div>
              </div>
              <span className="text-sm font-bold text-rose-500 ml-3 flex-shrink-0">PKR {formatPKR(getAmount(e))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PersonCard({ name, total, items, getAmount }: {
  name: string; total: number; items: ExpenseWithDetails[]; grandTotal: number; getAmount: (e: ExpenseWithDetails) => number
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button className="w-full px-4 py-3.5 flex items-center gap-3 text-left" onClick={() => setExpanded(x => !x)}>
        <div className="w-9 h-9 rounded-full bg-violet-50 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-violet-600">{name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{items.length} transaction{items.length !== 1 ? 's' : ''}</p>
        </div>
        <p className="text-sm font-bold text-rose-500 ml-2 flex-shrink-0">PKR {formatPKR(total)}</p>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {[...items].sort((a, b) => b.date.localeCompare(a.date)).map((e, i) => (
            <div key={e.id} className={cn('flex items-center justify-between px-4 py-2.5', i > 0 && 'border-t border-slate-50')}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-700 truncate">{e.description || e.categories?.name || 'Expense'}</p>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {e.categories && (
                    <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: e.categories.color }}>{e.categories.name}</span>
                  )}
                  {e.expense_allocations.map(a => (
                    <span key={a.part_id} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: a.project_parts?.color }}>{a.project_parts?.short_name}</span>
                  ))}
                  <span className="text-xs text-slate-400">{formatDate(e.date)}</span>
                </div>
              </div>
              <span className="text-xs font-bold text-rose-500 ml-2 flex-shrink-0">PKR {formatPKR(getAmount(e))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Categories Report ─────────────────────────────────────────────────────────

function CategoriesReport({ expenses, categories, getAmount, selectedPart }: {
  expenses: ExpenseWithDetails[]
  categories: Category[]
  getAmount: (e: ExpenseWithDetails) => number
  selectedPart?: ProjectPart
}) {
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())

  const totalOut = expenses.reduce((s, e) => s + getAmount(e), 0)
  const breakdown = categories.map(c => ({
    cat: c,
    total: expenses.filter(e => e.category_id === c.id).reduce((s, e) => s + getAmount(e), 0),
    count: expenses.filter(e => e.category_id === c.id).length,
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  const catOptions = breakdown.map(({ cat }) => ({ id: cat.id, label: cat.name, color: cat.color }))

  function toggleCat(id: string) {
    setSelectedCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isFiltered = selectedCats.size > 0
  const filteredExpenses = isFiltered
    ? [...expenses.filter(e => selectedCats.has(e.category_id ?? ''))].sort((a, b) => b.date.localeCompare(a.date))
    : []
  const filteredTotal = isFiltered
    ? filteredExpenses.reduce((s, e) => s + getAmount(e), 0)
    : totalOut

  const subLabel = selectedPart ? selectedPart.name : 'All Parts'

  return (
    <div className="space-y-2.5">
      <MultiSelectFilter
        noun="Categories"
        options={catOptions}
        selected={selectedCats}
        onToggle={toggleCat}
        onClear={() => setSelectedCats(new Set())}
      />

      <SummaryCard
        label={isFiltered
          ? selectedCats.size === 1
            ? (breakdown.find(b => selectedCats.has(b.cat.id))?.cat.name ?? 'Category')
            : `${selectedCats.size} categories`
          : 'Total Expenses'}
        value={`PKR ${formatPKR(filteredTotal)}`}
        sub={isFiltered
          ? `${filteredExpenses.length} transactions · ${subLabel}`
          : `${breakdown.length} categories · ${subLabel}`}
        color={isFiltered && selectedCats.size === 1
          ? breakdown.find(b => selectedCats.has(b.cat.id))?.cat.color
          : undefined}
      />

      {breakdown.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">No expenses recorded</p>
      )}

      {/* All-categories view: progress bar breakdown */}
      {!isFiltered && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {breakdown.map(({ cat, total, count }, i) => {
            const pct = totalOut > 0 ? (total / totalOut) * 100 : 0
            return (
              <div key={cat.id} className={cn('px-4 py-3.5', i > 0 && 'border-t border-slate-100')}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                    <span className="text-xs text-slate-400">{count} txn</span>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <span className="text-sm font-bold text-slate-800">PKR {formatPKR(total)}</span>
                    <span className="text-xs text-slate-400 ml-1.5">{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filtered view: flat transaction list */}
      {isFiltered && filteredExpenses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredExpenses.map((e, i) => (
            <div key={e.id} className={cn('flex items-center justify-between px-4 py-3', i > 0 && 'border-t border-slate-100')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  {selectedCats.size > 1 && e.categories && (
                    <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: e.categories.color }}>{e.categories.name}</span>
                  )}
                  <p className="text-sm font-medium text-slate-800 truncate">{e.description || e.categories?.name || 'Expense'}</p>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {e.paid_to && <span className="text-xs text-slate-500 font-medium">{e.paid_to}</span>}
                  {e.expense_allocations.map(a => (
                    <span key={a.part_id} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: a.project_parts?.color }}>{a.project_parts?.short_name}</span>
                  ))}
                  <span className="text-xs text-slate-400">{formatDate(e.date)}</span>
                </div>
              </div>
              <span className="text-sm font-bold text-rose-500 ml-3 flex-shrink-0">PKR {formatPKR(getAmount(e))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Parts Report (accumulative summary only) ──────────────────────────────────

function PartsReport({ transfers, expenses, parts, categories, selectedPart }: {
  transfers: TransferWithPart[]
  expenses: ExpenseWithDetails[]
  parts: ProjectPart[]
  categories: Category[]
  selectedPart?: ProjectPart
}) {
  // ── Single part view ──────────────────────────────────────────────────────
  if (selectedPart) {
    const deposited = transfers.reduce((s, t) => s + t.amount, 0)
    const spent = expenses.reduce((s, e) => {
      const alloc = e.expense_allocations.find(a => a.part_id === selectedPart.id)
      return s + (alloc?.amount ?? 0)
    }, 0)
    const balance = deposited - spent

    const catBreakdown = categories.map(c => ({
      cat: c,
      total: expenses.filter(e => e.category_id === c.id).reduce((s, e) => {
        const alloc = e.expense_allocations.find(a => a.part_id === selectedPart.id)
        return s + (alloc?.amount ?? 0)
      }, 0),
      count: expenses.filter(e => e.category_id === c.id).length,
    })).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

    return (
      <div className="space-y-2.5">
        <div className="rounded-2xl p-4 text-white" style={{ backgroundColor: selectedPart.color }}>
          <p className="text-xs font-semibold opacity-75 mb-2">{selectedPart.name} — Overview</p>
          <p className={cn('text-2xl font-bold', balance < 0 && 'text-red-200')}>
            {balance < 0 ? '−' : ''}PKR {formatPKR(Math.abs(balance))}
          </p>
          <p className="text-xs opacity-75 mt-0.5">{balance >= 0 ? 'remaining balance' : 'deficit'}</p>
          <div className="flex gap-5 mt-3 text-xs opacity-80">
            <span>↓ {formatPKR(deposited)} deposited</span>
            <span>↑ {formatPKR(spent)} spent</span>
          </div>
          {deposited > 0 && (
            <div className="mt-3">
              <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                <div className="h-full bg-white/80 rounded-full"
                  style={{ width: `${Math.min((spent / deposited) * 100, 100)}%` }} />
              </div>
              <p className="text-xs opacity-60 mt-1">{((spent / deposited) * 100).toFixed(0)}% spent</p>
            </div>
          )}
        </div>

        {catBreakdown.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-500 px-1">Spending by Category</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {catBreakdown.map(({ cat, total, count }, i) => {
                const pct = spent > 0 ? (total / spent) * 100 : 0
                return (
                  <div key={cat.id} className={cn('px-4 py-3.5', i > 0 && 'border-t border-slate-100')}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                        <span className="text-xs text-slate-400">{count} txn</span>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        <span className="text-sm font-bold text-slate-800">PKR {formatPKR(total)}</span>
                        <span className="text-xs text-slate-400 ml-1.5">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {catBreakdown.length === 0 && spent === 0 && deposited === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">No activity for this part</p>
        )}
      </div>
    )
  }

  // ── All-parts view ────────────────────────────────────────────────────────
  const summaries = parts.map(p => {
    const deposited = transfers.filter(t => t.part_id === p.id).reduce((s, t) => s + t.amount, 0)
    const spent = expenses.reduce((s, e) => {
      const alloc = e.expense_allocations.find(a => a.part_id === p.id)
      return s + (alloc?.amount ?? 0)
    }, 0)
    return { part: p, deposited, spent, balance: deposited - spent }
  })

  const totalDeposited = summaries.reduce((s, x) => s + x.deposited, 0)
  const totalSpent = summaries.reduce((s, x) => s + x.spent, 0)
  const totalBalance = totalDeposited - totalSpent

  return (
    <div className="space-y-2.5">
      <SummaryCard
        label={totalBalance >= 0 ? 'Total Balance' : 'Total Deficit'}
        value={`${totalBalance < 0 ? '−' : ''}PKR ${formatPKR(Math.abs(totalBalance))}`}
        sub={`${formatPKR(totalDeposited)} in · ${formatPKR(totalSpent)} out`}
        color={totalBalance < 0 ? '#dc2626' : '#16a34a'}
      />

      {summaries.map(({ part, deposited, spent, balance }) => (
        <div key={part.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 flex items-center justify-between" style={{ borderLeft: `4px solid ${part.color}` }}>
            <div>
              <p className="text-sm font-bold text-slate-900">{part.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{formatPKR(deposited)} in · {formatPKR(spent)} out</p>
            </div>
            <div className="text-right">
              <p className={cn('text-sm font-bold', balance >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {balance < 0 ? '−' : ''}PKR {formatPKR(Math.abs(balance))}
              </p>
              <p className="text-xs text-slate-400">{balance >= 0 ? 'remaining' : 'deficit'}</p>
            </div>
          </div>
          <div className="px-4 pb-3 pt-2 border-t border-slate-100">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full"
                style={{ width: `${deposited > 0 ? Math.min((spent / deposited) * 100, 100) : 0}%`, backgroundColor: part.color }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {deposited > 0 ? `${((spent / deposited) * 100).toFixed(0)}% spent` : 'No deposits yet'}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Deals Report ──────────────────────────────────────────────────────────────

function DealsReport({ deals, paidMap, filterPart, selectedPart }: {
  deals: DealWithPart[]
  paidMap: Record<string, Record<string, number>>
  filterPart: string
  selectedPart?: ProjectPart
}) {
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set())

  function getPaid(person: string): number {
    if (filterPart === 'all') return Object.values(paidMap[person] ?? {}).reduce((s, v) => s + v, 0)
    return paidMap[person]?.[filterPart] ?? 0
  }

  const personMap: Record<string, { agreed: number; items: DealWithPart[] }> = {}
  for (const d of deals) {
    const name = d.person_name || '(unspecified)'
    if (!personMap[name]) personMap[name] = { agreed: 0, items: [] }
    personMap[name].agreed += d.agreed_amount
    personMap[name].items.push(d)
  }
  const people = Object.entries(personMap)
    .map(([name, { agreed, items }]) => ({ name, agreed, paid: getPaid(name), items }))
    .sort((a, b) => b.agreed - a.agreed)

  const totalAgreed = people.reduce((s, p) => s + p.agreed, 0)
  const totalPaid = people.reduce((s, p) => s + p.paid, 0)
  const totalRemaining = totalAgreed - totalPaid

  function togglePerson(id: string) {
    setSelectedPeople(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isFiltered = selectedPeople.size > 0
  const visiblePeople = isFiltered ? people.filter(p => selectedPeople.has(p.name)) : people
  const filteredAgreed = visiblePeople.reduce((s, p) => s + p.agreed, 0)
  const filteredPaid = visiblePeople.reduce((s, p) => s + p.paid, 0)
  const filteredRemaining = filteredAgreed - filteredPaid

  const personOptions = people.map(p => ({ id: p.name, label: p.name }))
  const subLabel = selectedPart ? selectedPart.name : 'All Parts'

  return (
    <div className="space-y-2.5">
      <MultiSelectFilter
        noun="Contractors"
        options={personOptions}
        selected={selectedPeople}
        onToggle={togglePerson}
        onClear={() => setSelectedPeople(new Set())}
      />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
        <p className="text-xs text-slate-400 font-medium mb-2">{subLabel} · {deals.length} deal{deals.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-5">
          <div>
            <p className="text-xs text-slate-400">Agreed</p>
            <p className="text-base font-bold text-slate-900">PKR {formatPKR(filteredAgreed)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Paid</p>
            <p className="text-base font-bold text-emerald-600">PKR {formatPKR(filteredPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">{filteredRemaining < 0 ? 'Overpaid' : 'Remaining'}</p>
            <p className={cn('text-base font-bold', filteredRemaining < 0 ? 'text-red-500' : 'text-amber-500')}>
              {filteredRemaining < 0 ? '−' : ''}PKR {formatPKR(Math.abs(filteredRemaining))}
            </p>
          </div>
        </div>
      </div>

      {people.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">No deals recorded</p>
      )}

      {visiblePeople.map(({ name, agreed, paid, items }) => {
        const remaining = agreed - paid
        return (
          <DealPersonCard
            key={name}
            name={name}
            agreed={agreed}
            paid={paid}
            remaining={remaining}
            items={items}
          />
        )
      })}
    </div>
  )
}

function DealPersonCard({ name, agreed, paid, remaining, items }: {
  name: string; agreed: number; paid: number; remaining: number; items: DealWithPart[]
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button className="w-full px-4 py-3.5 flex items-center gap-3 text-left" onClick={() => setExpanded(x => !x)}>
        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-blue-600">{name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
          <div className="flex gap-3 mt-0.5 text-xs">
            <span className="text-slate-400">Agreed <span className="font-semibold text-slate-700">PKR {formatPKR(agreed)}</span></span>
            <span className="text-slate-400">Paid <span className="font-semibold text-emerald-600">PKR {formatPKR(paid)}</span></span>
          </div>
        </div>
        <span className={cn('text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0',
          remaining < 0 ? 'bg-red-50 text-red-600'
          : remaining === 0 ? 'bg-emerald-50 text-emerald-600'
          : 'bg-amber-50 text-amber-600')}>
          {remaining < 0 ? `−PKR ${formatPKR(Math.abs(remaining))}` : remaining === 0 ? 'Settled' : `PKR ${formatPKR(remaining)} left`}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {[...items].sort((a, b) => b.date.localeCompare(a.date)).map((d, i) => (
            <div key={d.id} className={cn('flex items-center justify-between px-4 py-2.5', i > 0 && 'border-t border-slate-50')}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-700 truncate">{d.name}</p>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {d.project_parts && (
                    <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: d.project_parts.color }}>{d.project_parts.short_name}</span>
                  )}
                  <span className="text-xs text-slate-400">{formatDate(d.date)}</span>
                  {d.notes && <span className="text-xs text-slate-400 italic">{d.notes}</span>}
                </div>
              </div>
              <span className="text-xs font-bold text-blue-600 ml-2 flex-shrink-0">PKR {formatPKR(d.agreed_amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
