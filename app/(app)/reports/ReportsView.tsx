'use client'

import { useState, useRef, useEffect } from 'react'
import { formatPKR, formatDate, cn } from '@/lib/utils'
import { dealTotal, sortedDealRevisions } from '@/lib/deals'
import { Plus, ReceiptText, ArrowDownToLine, Users, Tag, Layers, Handshake, ChevronDown, Check, Pencil, Wallet, TrendingDown, Scale, Flag, CheckCircle2, Clock3, Receipt, CalendarDays, UserRound } from 'lucide-react'
import ExpenseSheet from '@/components/ExpenseSheet'
import TransferSheet from '@/components/TransferSheet'
import DealSheet from '@/components/DealSheet'
import DealRevisionSheet from '@/components/DealRevisionSheet'
import NotesList from '@/components/NotesList'
import type { ProjectPart, Category, Transfer, Expense, ExpenseAllocation, DealRevision, DealWithPart } from '@/lib/types'

type TransferWithPart = Transfer & { project_parts: ProjectPart }
type ExpenseWithDetails = Expense & {
  categories: Category | null
  expense_allocations: (ExpenseAllocation & { project_parts: ProjectPart })[]
}
type Tab = 'parts' | 'deals' | 'categories' | 'people'

interface Props {
  parts: ProjectPart[]
  transfers: TransferWithPart[]
  expenses: ExpenseWithDetails[]
  categories: Category[]
  deals: DealWithPart[]
  paidMap: Record<string, Record<string, number>>
  isSupervisor: boolean
}

const PART_FILTER_KEY = 'hisab_reports_filter_part'

export default function ReportsView({ parts, transfers, expenses, categories, deals, paidMap, isSupervisor }: Props) {
  const [tab, setTab] = useState<Tab>('parts')
  const [reportTransfers, setReportTransfers] = useState(transfers)
  const [reportExpenses, setReportExpenses] = useState(expenses)
  const [reportDeals, setReportDeals] = useState(deals)
  const [reportPaidMap, setReportPaidMap] = useState(paidMap)
  const [filterPart, setFilterPart] = useState<string>(() =>
    typeof window === 'undefined' ? 'all' : localStorage.getItem(PART_FILTER_KEY) || 'all'
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addHintOpen, setAddHintOpen] = useState(false)
  const [sheet, setSheet] = useState<null | 'expense' | 'transfer' | 'deal'>(null)
  const [revisionDeal, setRevisionDeal] = useState<DealWithPart | null>(null)
  const [editingRevision, setEditingRevision] = useState<DealRevision | null>(null)
  const [editingDeal, setEditingDeal] = useState<DealWithPart | null>(null)
  const [editingExpense, setEditingExpense] = useState<ExpenseWithDetails | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false)
        setAddHintOpen(false)
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

  const scopedExpenses = reportExpenses.filter(e =>
    filterPart === 'all' || e.expense_allocations.some(a => a.part_id === filterPart)
  )
  const scopedTransfers = reportTransfers.filter(t =>
    filterPart === 'all' || t.part_id === filterPart
  )
  const scopedDeals = reportDeals.filter(d =>
    filterPart === 'all' || d.part_id === filterPart
  )

  function getAmount(e: ExpenseWithDetails): number {
    if (filterPart === 'all') return e.total_amount
    return e.expense_allocations.find(a => a.part_id === filterPart)?.amount ?? 0
  }

  const selectedPart = parts.find(p => p.id === filterPart)

  function openSheet(nextSheet: 'expense' | 'transfer' | 'deal') {
    if (nextSheet === 'deal') setEditingDeal(null)
    if (nextSheet === 'expense') setEditingExpense(null)
    setSheet(nextSheet)
    setAddOpen(false)
  }

  function saveDeal(data: DealWithPart) {
    if (editingDeal) {
      setReportDeals(prev => prev.map(deal => deal.id === data.id ? data : deal))
    } else {
      setReportDeals(prev => [data, ...prev])
    }
  }

  function openAddScope(deal: DealWithPart) {
    setEditingRevision(null)
    setRevisionDeal(deal)
  }

  function openEditRevision(deal: DealWithPart, revision: DealRevision) {
    setEditingRevision(revision)
    setRevisionDeal(deal)
  }

  function rebuildPaidMap(nextExpenses: ExpenseWithDetails[]) {
    const next: Record<string, Record<string, number>> = {}
    for (const expense of nextExpenses) {
      if (!expense.paid_to) continue
      next[expense.paid_to] ??= {}
      for (const allocation of expense.expense_allocations ?? []) {
        next[expense.paid_to][allocation.part_id] = (next[expense.paid_to][allocation.part_id] ?? 0) + Number(allocation.amount)
      }
    }
    setReportPaidMap(next)
  }

  function saveExpense(data: ExpenseWithDetails) {
    if (editingExpense) {
      setReportExpenses(prev => {
        const next = prev.map(expense => expense.id === data.id ? data : expense)
        rebuildPaidMap(next)
        return next
      })
    } else {
      const next = [data, ...reportExpenses]
      setReportExpenses(next)
      rebuildPaidMap(next)
    }
  }

  function openEditExpense(expense: ExpenseWithDetails) {
    setEditingExpense(expense)
    setSheet('expense')
  }

  const TABS = [
    { id: 'parts' as Tab,      icon: Layers,    label: 'Overview'   },
    { id: 'categories' as Tab, icon: Tag,        label: 'Expenses'   },
    { id: 'people' as Tab,     icon: Users,      label: 'People'     },
    { id: 'deals' as Tab,      icon: Handshake, label: 'Deals'      },
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
          <div className="relative" ref={addRef}>
            <button
              onClick={() => isSupervisor ? setAddOpen(o => !o) : setAddHintOpen(o => !o)}
              onMouseEnter={() => !isSupervisor && setAddHintOpen(true)}
              onMouseLeave={() => !isSupervisor && setAddHintOpen(false)}
              aria-disabled={!isSupervisor}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium shadow-sm',
                isSupervisor ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
            >
              <Plus size={14} />
              Add
            </button>
            {!isSupervisor && addHintOpen && (
              <div className="absolute top-full right-0 mt-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg px-2.5 py-1.5 shadow-lg z-30 whitespace-nowrap">
                Supervisor access required
              </div>
            )}
            {isSupervisor && addOpen && (
              <div className="absolute top-full right-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[170px] overflow-hidden">
                <button
                  onClick={() => openSheet('expense')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ReceiptText size={15} className="text-rose-500" />
                  Expense
                </button>
                <button
                  onClick={() => openSheet('transfer')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowDownToLine size={15} className="text-emerald-600" />
                  Transfer
                </button>
                <button
                  onClick={() => openSheet('deal')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Handshake size={15} className="text-blue-600" />
                  Deal
                </button>
              </div>
            )}
          </div>
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
      <div className="space-y-2.5">
        {tab === 'parts' &&
          <PartsReport transfers={scopedTransfers} expenses={scopedExpenses} deals={scopedDeals} parts={parts} selectedPart={selectedPart} />}
        {tab === 'deals' &&
          <DealsReport deals={scopedDeals} expenses={reportExpenses} paidMap={reportPaidMap} selectedPart={selectedPart} isSupervisor={isSupervisor} onAddScope={openAddScope} onEditDeal={(deal) => { setEditingDeal(deal); setSheet('deal') }} onEditRevision={openEditRevision} />}
        {tab === 'categories' &&
          <CategoriesReport expenses={scopedExpenses} categories={categories} getAmount={getAmount} selectedPart={selectedPart} isSupervisor={isSupervisor} onEditExpense={openEditExpense} />}
        {tab === 'people' &&
          <PeopleReport expenses={scopedExpenses} getAmount={getAmount} selectedPart={selectedPart} isSupervisor={isSupervisor} onEditExpense={openEditExpense} />}
        <p className="text-center text-xs text-slate-300 pt-1">Hisaab · {new Date().toLocaleDateString('en-PK')}</p>
      </div>

      <ExpenseSheet
        open={sheet === 'expense'}
        onClose={() => { setSheet(null); setEditingExpense(null) }}
        onSaved={saveExpense}
        parts={parts}
        categories={categories}
        editing={editingExpense}
      />
      <TransferSheet
        open={sheet === 'transfer'}
        onClose={() => setSheet(null)}
        onSaved={(data) => setReportTransfers(prev => [data, ...prev])}
      />
      <DealSheet
        open={sheet === 'deal'}
        onClose={() => { setSheet(null); setEditingDeal(null) }}
        onSaved={saveDeal}
        parts={parts}
        editing={editingDeal}
        existingDeals={reportDeals}
        onAddScope={openAddScope}
      />
      <DealRevisionSheet
        open={!!revisionDeal}
        deal={revisionDeal}
        editingRevision={editingRevision}
        onClose={() => { setRevisionDeal(null); setEditingRevision(null) }}
        onSaved={(data) => setReportDeals(prev => prev.map(deal => deal.id === data.id ? data : deal))}
      />
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

function MiniMetric({ icon: Icon, label, value, color, bg }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  color: string
  bg: string
}) {
  return (
    <div className="min-w-0">
      <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center mb-1', bg)}>
        <Icon size={14} className={color} />
      </div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cn('text-xs font-bold truncate', color)}>{value}</p>
    </div>
  )
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

function ExpenseMeta({ expense, showCategory = true, showPerson = true }: {
  expense: ExpenseWithDetails
  showCategory?: boolean
  showPerson?: boolean
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
        {showPerson && expense.paid_to && (
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

function ExpenseParts({ expense }: { expense: ExpenseWithDetails }) {
  return (
    <>
      {expense.expense_allocations.map(allocation => (
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

function LinkedExpenseTag({ expense, selectedPart }: { expense: ExpenseWithDetails; selectedPart?: ProjectPart }) {
  const allocationCount = expense.expense_allocations.length
  if (allocationCount <= 1) return null

  const allocationIndex = selectedPart
    ? expense.expense_allocations.findIndex(allocation => allocation.part_id === selectedPart.id) + 1
    : 0

  return (
    <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
      {allocationIndex > 0 ? `linked ${allocationIndex} of ${allocationCount}` : `linked ${allocationCount} parts`}
    </span>
  )
}

function ShareMeter({ percent, color }: {
  percent: number
  color: string
}) {
  return (
    <div className="mt-2" aria-label={`Expense share ${percent.toFixed(0)} percent`}>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} />
      </div>
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

function PeopleReport({ expenses, getAmount, selectedPart, isSupervisor, onEditExpense }: {
  expenses: ExpenseWithDetails[]
  getAmount: (e: ExpenseWithDetails) => number
  selectedPart?: ProjectPart
  isSupervisor: boolean
  onEditExpense: (expense: ExpenseWithDetails) => void
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
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
        <PersonCard key={name} name={name} total={total} items={items} grandTotal={grandTotal} getAmount={getAmount} selectedPart={selectedPart} isSupervisor={isSupervisor} onEditExpense={onEditExpense} />
      ))}

      {/* Filtered view: flat transaction list */}
      {isFiltered && filteredItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredItems.map((e, i) => (
            <div key={e.id} className={cn('flex items-center justify-between px-4 py-3', i > 0 && 'border-t border-slate-100')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <ExpenseParts expense={e} />
                  <LinkedExpenseTag expense={e} selectedPart={selectedPart} />
                  <p className="text-sm font-medium text-slate-800 truncate">{e.description || e.categories?.name || 'Expense'}</p>
                </div>
                <ExpenseMeta expense={e} showPerson={selectedPeople.size > 1} />
                <NotesList notes={e.notes} />
              </div>
              <div className="ml-3 flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-sm font-bold text-rose-500">PKR {formatPKR(getAmount(e))}</span>
                {isSupervisor && (
                  <button onClick={() => onEditExpense(e)} className="text-slate-400 active:text-blue-600" title="Edit expense" aria-label="Edit expense">
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PersonCard({ name, total, items, getAmount, selectedPart, isSupervisor, onEditExpense }: {
  name: string; total: number; items: ExpenseWithDetails[]; grandTotal: number; getAmount: (e: ExpenseWithDetails) => number
  selectedPart?: ProjectPart
  isSupervisor: boolean; onEditExpense: (expense: ExpenseWithDetails) => void
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ExpenseParts expense={e} />
                  <LinkedExpenseTag expense={e} selectedPart={selectedPart} />
                  <p className="text-xs font-medium text-slate-700 truncate">{e.description || e.categories?.name || 'Expense'}</p>
                </div>
                <ExpenseMeta expense={e} showPerson={false} />
                <NotesList notes={e.notes} />
              </div>
              <div className="ml-2 flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs font-bold text-rose-500">PKR {formatPKR(getAmount(e))}</span>
                {isSupervisor && (
                  <button onClick={() => onEditExpense(e)} className="text-slate-400 active:text-blue-600" title="Edit expense" aria-label="Edit expense">
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Categories Report ─────────────────────────────────────────────────────────

function CategoriesReport({ expenses, categories, getAmount, selectedPart, isSupervisor, onEditExpense }: {
  expenses: ExpenseWithDetails[]
  categories: Category[]
  getAmount: (e: ExpenseWithDetails) => number
  selectedPart?: ProjectPart
  isSupervisor: boolean
  onEditExpense: (expense: ExpenseWithDetails) => void
}) {
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())

  // Only leaf categories (not group headers)
  const leafCategories = categories.filter(c => !c.is_group)

  const totalOut = expenses.reduce((s, e) => s + getAmount(e), 0)
  const breakdown = leafCategories.map(c => ({
    cat: c,
    total: expenses.filter(e => e.category_id === c.id).reduce((s, e) => s + getAmount(e), 0),
    count: expenses.filter(e => e.category_id === c.id).length,
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  const catOptions = breakdown.map(({ cat }) => ({ id: cat.id, label: cat.name, color: cat.color }))

  function toggleCat(id: string) {
    setSelectedCats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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

      {/* All-categories view: expandable category cards */}
      {!isFiltered && breakdown.map(({ cat, total, count }) => {
        const items = expenses.filter(e => e.category_id === cat.id).sort((a, b) => b.date.localeCompare(a.date))
        const pct = totalOut > 0 ? (total / totalOut) * 100 : 0
        return (
          <CategoryCard key={cat.id} cat={cat} total={total} count={count} pct={pct} items={items} getAmount={getAmount} selectedPart={selectedPart} isSupervisor={isSupervisor} onEditExpense={onEditExpense} />
        )
      })}

      {/* Filtered view: flat transaction list grouped by category */}
      {isFiltered && filteredExpenses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredExpenses.map((e, i) => (
            <div key={e.id} className={cn('flex items-center justify-between px-4 py-3', i > 0 && 'border-t border-slate-100')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <ExpenseParts expense={e} />
                  <LinkedExpenseTag expense={e} selectedPart={selectedPart} />
                  {selectedCats.size > 1 && e.categories && (
                    <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: e.categories.color }}>{e.categories.name}</span>
                  )}
                  <p className="text-sm font-medium text-slate-800 truncate">{e.description || e.categories?.name || 'Expense'}</p>
                </div>
                <ExpenseMeta expense={e} showCategory={selectedCats.size <= 1} />
                <NotesList notes={e.notes} />
              </div>
              <div className="ml-3 flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-sm font-bold text-rose-500">PKR {formatPKR(getAmount(e))}</span>
                {isSupervisor && (
                  <button onClick={() => onEditExpense(e)} className="text-slate-400 active:text-blue-600" title="Edit expense" aria-label="Edit expense">
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryCard({ cat, total, count, pct, items, getAmount, selectedPart, isSupervisor, onEditExpense }: {
  cat: Category; total: number; count: number; pct: number
  items: ExpenseWithDetails[]; getAmount: (e: ExpenseWithDetails) => number
  selectedPart?: ProjectPart
  isSupervisor: boolean; onEditExpense: (expense: ExpenseWithDetails) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        className="w-full px-4 py-3.5 text-left"
        onClick={() => setExpanded(x => !x)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setExpanded(x => !x)
          }
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
            <span className="text-sm font-semibold text-slate-800 truncate">{cat.name}</span>
            <span className="text-xs text-slate-400 flex-shrink-0">{count} txn</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            <span className="text-sm font-bold text-slate-800">PKR {formatPKR(total)}</span>
          </div>
        </div>
        <ShareMeter percent={pct} color={cat.color} />
      </div>

      {expanded && (
        <div className="border-t border-slate-100">
          {items.map((e, i) => (
            <div key={e.id} className={cn('flex items-center justify-between px-4 py-2.5', i > 0 && 'border-t border-slate-50')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ExpenseParts expense={e} />
                  <LinkedExpenseTag expense={e} selectedPart={selectedPart} />
                  <p className="text-xs font-medium text-slate-700 truncate">{e.description || cat.name}</p>
                </div>
                <ExpenseMeta expense={e} showCategory={false} />
                <NotesList notes={e.notes} />
              </div>
              <div className="ml-2 flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs font-bold text-rose-500">PKR {formatPKR(getAmount(e))}</span>
                {isSupervisor && (
                  <button onClick={() => onEditExpense(e)} className="text-slate-400 active:text-blue-600" title="Edit expense" aria-label="Edit expense">
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Parts Report (accumulative summary only) ──────────────────────────────────

function PartsReport({ transfers, expenses, deals, parts, selectedPart }: {
  transfers: TransferWithPart[]
  expenses: ExpenseWithDetails[]
  deals: DealWithPart[]
  parts: ProjectPart[]
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

    const topDeal = deals.reduce<DealWithPart | null>((top, deal) => {
      if (!top || dealTotal(deal) > dealTotal(top)) return deal
      return top
    }, null)
    const topExpense = expenses.reduce<{ expense: ExpenseWithDetails; amount: number } | null>((top, expense) => {
      const alloc = expense.expense_allocations.find(a => a.part_id === selectedPart.id)
      const amount = Number(alloc?.amount ?? expense.total_amount)
      if (!top || amount > top.amount) return { expense, amount }
      return top
    }, null)
    const recentItems = [
      ...transfers.map(item => ({
        id: `transfer-${item.id}`,
        type: 'Transfer' as const,
        label: item.from_person || 'Transfer received',
        date: item.date,
        amount: Number(item.amount),
        tone: 'text-emerald-600',
        icon: ArrowDownToLine,
      })),
      ...expenses.map(item => {
        const alloc = item.expense_allocations.find(a => a.part_id === selectedPart.id)
        return {
          id: `expense-${item.id}`,
          type: 'Expense' as const,
          label: item.description || item.categories?.name || 'Expense',
          date: item.date,
          amount: Number(alloc?.amount ?? item.total_amount),
          tone: 'text-rose-500',
          icon: TrendingDown,
        }
      }),
      ...deals.map(item => ({
        id: `deal-${item.id}`,
        type: 'Deal' as const,
        label: item.name,
        date: item.date,
        amount: dealTotal(item),
        tone: 'text-blue-600',
        icon: Handshake,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    const spentPct = deposited > 0 ? Math.min((spent / deposited) * 100, 100) : 0
    const rawSpentPct = deposited > 0 ? (spent / deposited) * 100 : 0

    return (
      <div className="space-y-2.5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5" style={{ borderLeft: `4px solid ${selectedPart.color}` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">{selectedPart.name} Balance</p>
                <p className={cn('text-2xl font-bold mt-1', balance < 0 ? 'text-red-500' : 'text-emerald-600')}>
                  {balance < 0 ? '−' : ''}PKR {formatPKR(Math.abs(balance))}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{balance >= 0 ? 'remaining balance' : 'deficit'}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-lg text-white flex-shrink-0" style={{ backgroundColor: selectedPart.color }}>
                {selectedPart.short_name}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <MiniMetric icon={Wallet} label="Received" value={`PKR ${formatPKR(deposited)}`} color="text-emerald-600" bg="bg-emerald-50" />
              <MiniMetric icon={TrendingDown} label="Spent" value={`PKR ${formatPKR(spent)}`} color="text-rose-500" bg="bg-rose-50" />
              <MiniMetric icon={Scale} label={balance < 0 ? 'Deficit' : 'Remaining'} value={`PKR ${formatPKR(Math.abs(balance))}`} color={balance < 0 ? 'text-red-500' : 'text-amber-600'} bg={balance < 0 ? 'bg-red-50' : 'bg-amber-50'} />
            </div>
          </div>
          {deposited > 0 && (
            <div className="px-4 pb-3">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${spentPct}%`, backgroundColor: selectedPart.color }} />
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
                <span>{rawSpentPct.toFixed(0)}% spent</span>
                <span>{balance < 0 ? 'over budget' : 'within deposits'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm min-w-0">
            <p className="text-xs text-slate-400 font-medium">Top Deal</p>
            <p className="text-base leading-snug font-bold text-blue-600 mt-1 line-clamp-2 break-words">
              {topDeal ? topDeal.name : '-'}
            </p>
            <p className="text-xs text-slate-400 mt-1">{topDeal ? `PKR ${formatPKR(dealTotal(topDeal))}` : 'none'}</p>
          </div>
          <div className="bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm min-w-0">
            <p className="text-xs text-slate-400 font-medium">Top Expense</p>
            <p className="text-base leading-snug font-bold text-rose-500 mt-1 line-clamp-2 break-words">
              {topExpense ? topExpense.expense.description || topExpense.expense.categories?.name || 'Expense' : '-'}
            </p>
            <p className="text-xs text-slate-400 mt-1">{topExpense ? `PKR ${formatPKR(topExpense.amount)}` : 'none'}</p>
          </div>
        </div>

        {recentItems.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-500 px-1">Recent Activity</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {recentItems.map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={item.id} className={cn('flex items-center justify-between gap-3 px-4 py-3', i > 0 && 'border-t border-slate-100')}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0">
                        <Icon size={15} className={item.tone} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400">{item.type}</span>
                          <span className="text-[11px] text-slate-300">{formatDate(item.date)}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 truncate">{item.label}</p>
                      </div>
                    </div>
                    <span className={cn('text-xs font-bold flex-shrink-0', item.tone)}>PKR {formatPKR(item.amount)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {recentItems.length === 0 && spent === 0 && deposited === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">No transactions for this part</p>
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
  const transferCount = transfers.length
  const expenseCount = expenses.length
  const activeParts = summaries.filter(x => x.deposited > 0 || x.spent > 0).length
  const topSpentPart = summaries.reduce<typeof summaries[number] | null>((top, item) => {
    if (!top || item.spent > top.spent) return item
    return top
  }, null)
  const spentPct = totalDeposited > 0 ? Math.min((totalSpent / totalDeposited) * 100, 100) : 0

  return (
    <div className="space-y-2.5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3.5">
          <p className="text-xs text-slate-400 font-medium mb-1">Overall Balance</p>
          <p className={cn('text-2xl font-bold', totalBalance < 0 ? 'text-red-500' : 'text-emerald-600')}>
            {totalBalance < 0 ? '−' : ''}PKR {formatPKR(Math.abs(totalBalance))}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <MiniMetric icon={Wallet} label="Received" value={`PKR ${formatPKR(totalDeposited)}`} color="text-emerald-600" bg="bg-emerald-50" />
            <MiniMetric icon={TrendingDown} label="Spent" value={`PKR ${formatPKR(totalSpent)}`} color="text-rose-500" bg="bg-rose-50" />
            <MiniMetric icon={Scale} label={totalBalance < 0 ? 'Deficit' : 'Remaining'} value={`PKR ${formatPKR(Math.abs(totalBalance))}`} color={totalBalance < 0 ? 'text-red-500' : 'text-amber-600'} bg={totalBalance < 0 ? 'bg-red-50' : 'bg-amber-50'} />
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${spentPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
            <span>{totalDeposited > 0 ? `${(totalSpent / totalDeposited * 100).toFixed(0)}% spent` : 'No received funds yet'}</span>
            <span>{activeParts} active part{activeParts !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="Transfers" value={String(transferCount)} sub="received" />
        <SummaryCard label="Expenses" value={String(expenseCount)} sub="paid out" />
        <SummaryCard label="Top Spend" value={topSpentPart?.spent ? topSpentPart.part.short_name : '-'} sub={topSpentPart?.spent ? `PKR ${formatPKR(topSpentPart.spent)}` : 'none'} color={topSpentPart?.part.color} />
      </div>

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

function DealsReport({ deals, expenses, paidMap, selectedPart, isSupervisor, onAddScope, onEditDeal, onEditRevision }: {
  deals: DealWithPart[]
  expenses: ExpenseWithDetails[]
  paidMap: Record<string, Record<string, number>>
  selectedPart?: ProjectPart
  isSupervisor: boolean
  onAddScope: (deal: DealWithPart) => void
  onEditDeal: (deal: DealWithPart) => void
  onEditRevision: (deal: DealWithPart, revision: DealRevision) => void
}) {
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set())

  const personMap: Record<string, { agreed: number; paid: number; groups: Record<string, { part?: ProjectPart; partId: string; agreed: number; paid: number; items: DealWithPart[] }> }> = {}
  for (const d of deals) {
    const name = d.person_name || '(unspecified)'
    if (!personMap[name]) personMap[name] = { agreed: 0, paid: 0, groups: {} }
    if (!personMap[name].groups[d.part_id]) {
      personMap[name].groups[d.part_id] = {
        part: d.project_parts,
        partId: d.part_id,
        agreed: 0,
        paid: paidMap[name]?.[d.part_id] ?? 0,
        items: [],
      }
    }
    const amount = dealTotal(d)
    personMap[name].agreed += amount
    personMap[name].groups[d.part_id].agreed += amount
    personMap[name].groups[d.part_id].items.push(d)
  }
  for (const person of Object.values(personMap)) {
    person.paid = Object.values(person.groups).reduce((sum, group) => sum + group.paid, 0)
  }
  const people = Object.entries(personMap)
    .map(([name, { agreed, paid, groups }]) => ({ name, agreed, paid, groups: Object.values(groups).sort((a, b) => b.agreed - a.agreed) }))
    .sort((a, b) => b.agreed - a.agreed)

  function togglePerson(id: string) {
    setSelectedPeople(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isFiltered = selectedPeople.size > 0
  const visiblePeople = isFiltered ? people.filter(p => selectedPeople.has(p.name)) : people
  const filteredAgreed = visiblePeople.reduce((s, p) => s + p.agreed, 0)
  const filteredPaid = visiblePeople.reduce((s, p) => s + p.paid, 0)
  const filteredRemaining = filteredAgreed - filteredPaid
  const summaryStatus = dealStatus(filteredRemaining)
  const SummaryStatusIcon = summaryStatus.icon

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
            <div className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold mb-1', summaryStatus.chip)}>
              <SummaryStatusIcon size={11} />
              {summaryStatus.label}
            </div>
            <p className={cn('text-base font-bold', summaryStatus.text)}>
              {filteredRemaining === 0 ? 'PKR 0' : `${filteredRemaining < 0 ? '−' : ''}PKR ${formatPKR(Math.abs(filteredRemaining))}`}
            </p>
          </div>
        </div>
      </div>

      {people.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">No deals recorded</p>
      )}

      {visiblePeople.map(({ name, agreed, paid, groups }) => {
        const remaining = agreed - paid
        return (
          <DealPersonCard
            key={name}
            name={name}
            agreed={agreed}
            paid={paid}
            remaining={remaining}
            groups={groups}
            expenses={expenses}
            isSupervisor={isSupervisor}
            onAddScope={onAddScope}
            onEditDeal={onEditDeal}
            onEditRevision={onEditRevision}
          />
        )
      })}
    </div>
  )
}

function DealPersonCard({ name, agreed, paid, remaining, groups, expenses, isSupervisor, onAddScope, onEditDeal, onEditRevision }: {
  name: string
  agreed: number
  paid: number
  remaining: number
  groups: { part?: ProjectPart; partId: string; agreed: number; paid: number; items: DealWithPart[] }[]
  expenses: ExpenseWithDetails[]
  isSupervisor: boolean
  onAddScope: (deal: DealWithPart) => void
  onEditDeal: (deal: DealWithPart) => void
  onEditRevision: (deal: DealWithPart, revision: DealRevision) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set())
  const status = dealStatus(remaining)
  const StatusIcon = status.icon

  function togglePayments(partId: string) {
    setExpandedPayments(prev => {
      const next = new Set(prev)
      if (next.has(partId)) next.delete(partId)
      else next.add(partId)
      return next
    })
  }

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
        <div className="text-right flex-shrink-0">
          <div className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold mb-0.5', status.chip)}>
            <StatusIcon size={11} />
            {status.label}
          </div>
          <p className={cn('text-xs font-bold', status.text)}>
            {remaining === 0 ? 'PKR 0' : `${remaining < 0 ? '−' : ''}PKR ${formatPKR(Math.abs(remaining))}`}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {groups.map((group, groupIndex) => {
            const groupRemaining = group.agreed - group.paid
            const groupStatus = dealStatus(groupRemaining)
            const GroupStatusIcon = groupStatus.icon
            const groupPayments = expenses
              .filter(e => e.paid_to === name && e.expense_allocations.some(a => a.part_id === group.partId))
              .sort((a, b) => b.date.localeCompare(a.date))
            const isPaymentsExpanded = expandedPayments.has(group.partId)
            return (
              <div key={group.partId} className={cn('px-4 py-3', groupIndex > 0 && 'border-t border-slate-100')}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {group.part && <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: group.part.color }}>{group.part.short_name}</span>}
                    <span className="text-xs font-semibold text-slate-700 truncate">{group.part?.name ?? 'Part'}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold', groupStatus.chip)}>
                      <GroupStatusIcon size={11} />
                      {groupStatus.label}
                    </div>
                    <p className={cn('text-xs font-bold mt-0.5', groupStatus.text)}>
                      {groupRemaining === 0 ? 'PKR 0' : `${groupRemaining < 0 ? '−' : ''}PKR ${formatPKR(Math.abs(groupRemaining))}`}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[...group.items].sort((a, b) => b.date.localeCompare(a.date)).map(d => (
                    <div key={d.id} className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700 truncate">{d.name}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-bold text-blue-600">PKR {formatPKR(dealTotal(d))}</span>
                          {isSupervisor && (
                            <>
                              <button onClick={() => onAddScope(d)} className="text-slate-400 active:text-blue-600" title="Add scope" aria-label="Add scope">
                                <Plus size={14} />
                              </button>
                              <button onClick={() => onEditDeal(d)} className="text-slate-400 active:text-blue-600" title="Edit deal">
                                <Pencil size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {sortedDealRevisions(d).map(revision => (
                          <div key={revision.id} className="flex items-start justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <p className="text-slate-500 truncate">V{revision.revision_number} · {revision.scope_description}</p>
                              <p className="text-slate-400">{formatDate(revision.date)}</p>
                              <NotesList notes={revision.notes} />
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={cn('font-semibold', revision.amount_delta < 0 ? 'text-red-500' : 'text-blue-600')}>
                                {revision.amount_delta > 0 ? '+' : '−'}PKR {formatPKR(Math.abs(revision.amount_delta))}
                              </span>
                              {isSupervisor && (
                                <button onClick={() => onEditRevision(d, revision)} className="text-slate-400 active:text-blue-600" title={`Edit V${revision.revision_number}`} aria-label={`Edit V${revision.revision_number}`}>
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {groupPayments.length > 0 && (
                  <div className="mt-2 -mx-1">
                    <button
                      onClick={() => togglePayments(group.partId)}
                      className="w-full flex items-center justify-between px-1 py-1.5 text-xs font-medium text-slate-500"
                    >
                      <span className="flex items-center gap-1.5">
                        <Receipt size={12} />
                        Payments ({groupPayments.length})
                      </span>
                      <ChevronDown size={11} className={cn('transition-transform', isPaymentsExpanded && 'rotate-180')} />
                    </button>

                    {isPaymentsExpanded && (
                      <div className="space-y-1 mt-0.5">
                        {groupPayments.map(e => {
                          const alloc = e.expense_allocations.find(a => a.part_id === group.partId)
                          return (
                            <div key={e.id} className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-700 truncate">{e.description}</p>
                                <p className="text-[11px] text-slate-400">{formatDate(e.date)}</p>
                                <NotesList notes={e.notes} className="text-[11px]" />
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
            )
          })}
        </div>
      )}
    </div>
  )
}
