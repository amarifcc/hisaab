'use client'

import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import { formatPKR, formatDate, cn } from '@/lib/utils'
import { dealTotal, sortedDealRevisions } from '@/lib/deals'
import { confirmTypedDelete } from '@/lib/confirm-delete'
import { Plus, ReceiptText, ArrowDownToLine, ArrowDownLeft, Users, Tag, Layers, Handshake, ChevronDown, ChevronUp, Check, Pencil, TrendingDown, Scale, Flag, CheckCircle2, Clock3, Receipt, CalendarDays, UserRound, List, Clock, Search, X, Trash2, SlidersHorizontal } from 'lucide-react'
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
type Tab = 'parts' | 'deals' | 'categories' | 'transfers'
type ExpenseView = 'category' | 'person' | 'list'
type RecentActivityTab = 'expenses' | 'transfers' | 'deals'
type RecentActivityItem = {
  id: string
  label: string
  date: string
  activitySort: number
  activityLabel: string | null
  notes?: string | null
  amount: number
  tone: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

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
const PART_FILTER_CHANGE_EVENT = 'hisab_reports_filter_part_change'

function getStoredPartFilter() {
  if (typeof window === 'undefined') return 'all'
  return localStorage.getItem(PART_FILTER_KEY) || 'all'
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

export default function HomeView({ parts, transfers, expenses, categories, deals, paidMap, isSupervisor }: Props) {
  const [tab, setTab] = useState<Tab>('parts')
  const [reportTransfers, setReportTransfers] = useState(transfers)
  const [reportExpenses, setReportExpenses] = useState(expenses)
  const [reportDeals, setReportDeals] = useState(deals)
  const [reportPaidMap, setReportPaidMap] = useState(paidMap)
  const filterPart = useSyncExternalStore(subscribePartFilter, getStoredPartFilter, () => 'all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addHintOpen, setAddHintOpen] = useState(false)
  const [sheet, setSheet] = useState<null | 'expense' | 'transfer' | 'deal'>(null)
  const [revisionDeal, setRevisionDeal] = useState<DealWithPart | null>(null)
  const [editingRevision, setEditingRevision] = useState<DealRevision | null>(null)
  const [editingDeal, setEditingDeal] = useState<DealWithPart | null>(null)
  const [editingExpense, setEditingExpense] = useState<ExpenseWithDetails | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<TransferWithPart | null>(null)
  const [expenseView, setExpenseView] = useState<ExpenseView>('list')
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
    localStorage.setItem(PART_FILTER_KEY, val)
    window.dispatchEvent(new Event(PART_FILTER_CHANGE_EVENT))
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
    if (!isSupervisor) return
    if (nextSheet === 'deal') setEditingDeal(null)
    if (nextSheet === 'expense') setEditingExpense(null)
    if (nextSheet === 'transfer') setEditingTransfer(null)
    setSheet(nextSheet)
    setAddOpen(false)
  }

  function saveDeal(data: DealWithPart) {
    if (!isSupervisor) return
    if (editingDeal) {
      setReportDeals(prev => prev.map(deal => deal.id === data.id ? data : deal))
    } else {
      setReportDeals(prev => [data, ...prev])
    }
  }

  function openAddScope(deal: DealWithPart) {
    if (!isSupervisor) return
    setEditingRevision(null)
    setRevisionDeal(deal)
  }

  function openEditRevision(deal: DealWithPart, revision: DealRevision) {
    if (!isSupervisor) return
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
    if (!isSupervisor) return
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
    if (!isSupervisor) return
    setEditingExpense(expense)
    setSheet('expense')
  }

  function openEditTransfer(transfer: TransferWithPart) {
    if (!isSupervisor) return
    setEditingTransfer(transfer)
    setSheet('transfer')
  }

  function openEditDeal(deal: DealWithPart) {
    if (!isSupervisor) return
    setEditingDeal(deal)
    setSheet('deal')
  }

  async function deleteExpense(id: string) {
    if (!isSupervisor) return
    if (!confirmTypedDelete('Delete this expense?')) return
    const res = await fetch('/api/expenses', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
    if (res.ok) {
      const next = reportExpenses.filter(e => e.id !== id)
      setReportExpenses(next)
      rebuildPaidMap(next)
    }
  }

  async function deleteTransfer(id: string) {
    if (!isSupervisor) return
    if (!confirmTypedDelete('Delete this transfer?')) return
    const res = await fetch('/api/transfers', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
    if (res.ok) setReportTransfers(prev => prev.filter(t => t.id !== id))
  }

  async function deleteDeal(id: string) {
    if (!isSupervisor) return
    if (!confirmTypedDelete('Delete this deal?')) return
    const res = await fetch('/api/deals', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
    if (res.ok) setReportDeals(prev => prev.filter(d => d.id !== id))
  }

  const TABS = [
    { id: 'parts' as Tab,      icon: Layers,           label: 'Overview'   },
    { id: 'categories' as Tab, icon: Tag,               label: 'Expenses'   },
    { id: 'transfers' as Tab,  icon: ArrowDownToLine,   label: 'Transfers'  },
    { id: 'deals' as Tab,      icon: Handshake,         label: 'Deals'      },
  ]

  return (
    <div className="px-4 pt-5 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Home</h1>
        <div className="flex items-center gap-2">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm border transition-colors',
                dropdownOpen
                  ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-100'
                  : 'bg-white border-blue-100 text-slate-800'
              )}
            >
              <SlidersHorizontal size={14} className="text-blue-600" />
              {selectedPart && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedPart.color }} />}
              {selectedPart ? selectedPart.name : 'All Parts'}
              <ChevronDown size={13} className={cn('transition-transform text-blue-600', dropdownOpen && 'rotate-180')} />
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
        {tab === 'transfers' &&
          <TransfersListReport transfers={scopedTransfers} isSupervisor={isSupervisor} onEdit={openEditTransfer} onDelete={deleteTransfer} />}
        {tab === 'deals' &&
          <DealsReport deals={scopedDeals} expenses={reportExpenses} paidMap={reportPaidMap} selectedPart={selectedPart} isSupervisor={isSupervisor} onAddScope={openAddScope} onEditDeal={openEditDeal} onEditRevision={openEditRevision} onDeleteDeal={deleteDeal} />}
        {tab === 'categories' && (
          <div className="space-y-2.5">
            <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
              <button
                onClick={() => setExpenseView('list')}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
                  expenseView === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
              >
                <List size={12} />
                List
              </button>
              <button
                onClick={() => setExpenseView('category')}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
                  expenseView === 'category' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
              >
                <Tag size={12} />
                Category
              </button>
              <button
                onClick={() => setExpenseView('person')}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
                  expenseView === 'person' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
              >
                <Users size={12} />
                Person
              </button>
            </div>
            {expenseView === 'list' && <ExpensesListReport expenses={scopedExpenses} selectedPart={selectedPart} isSupervisor={isSupervisor} onEditExpense={openEditExpense} onDeleteExpense={deleteExpense} />}
            {expenseView === 'category' && <CategoriesReport expenses={scopedExpenses} categories={categories} getAmount={getAmount} selectedPart={selectedPart} isSupervisor={isSupervisor} onEditExpense={openEditExpense} />}
            {expenseView === 'person' && <PeopleReport expenses={scopedExpenses} getAmount={getAmount} selectedPart={selectedPart} isSupervisor={isSupervisor} onEditExpense={openEditExpense} />}
          </div>
        )}
        <p className="text-center text-xs text-slate-300 pt-1" suppressHydrationWarning>
          Hisaab · {new Date().toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
        </p>
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
        onClose={() => { setSheet(null); setEditingTransfer(null) }}
        onSaved={(data) => {
          if (!isSupervisor) return
          if (editingTransfer) {
            setReportTransfers(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t))
          } else {
            setReportTransfers(prev => [data as TransferWithPart, ...prev])
          }
          setEditingTransfer(null)
        }}
        editing={editingTransfer}
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
        onSaved={(data) => {
          if (!isSupervisor) return
          setReportDeals(prev => prev.map(deal => deal.id === data.id ? data : deal))
        }}
      />
    </div>
  )
}

// ── Shared summary card ───────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-lg font-bold mt-0.5 text-slate-900" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function DateSortButton({ sortByLog, onToggle }: { sortByLog: boolean; onToggle: () => void }) {
  const Icon = sortByLog ? Clock : CalendarDays
  const current = sortByLog ? 'log entry date' : 'transaction date'
  const next = sortByLog ? 'transaction date' : 'log entry date'

  return (
    <button
      onClick={onToggle}
      title={`Sorted by ${current}. Tap to sort by ${next}.`}
      aria-label={`Sorted by ${current}. Tap to sort by ${next}.`}
      className={cn(
        'p-2 rounded-xl border transition-colors flex-shrink-0',
        sortByLog ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500'
      )}
    >
      <Icon size={14} />
    </button>
  )
}

function todayDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10)
}

function isTodayDate(dateStr?: string | null) {
  if (!dateStr) return false
  return dateStr.slice(0, 10) === todayDateKey()
}

function TodayChip({ date }: { date?: string | null }) {
  if (!isTodayDate(date)) return null

  return (
    <span
      className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0"
      suppressHydrationWarning
    >
      Today
    </span>
  )
}

function activityTimeValue(dateStr?: string | null) {
  if (!dateStr) return 0
  const value = Date.parse(dateStr)
  return Number.isNaN(value) ? 0 : value
}

function recentActivitySortValue(...dates: (string | null | undefined)[]) {
  return Math.max(...dates.map(activityTimeValue))
}

function recentActivityLabel(date?: string | null, createdAt?: string | null, updatedAt?: string | null) {
  if (isTodayDate(date)) return 'Today'
  if (isTodayDate(createdAt)) return 'Added today'
  if (isTodayDate(updatedAt)) return 'Updated today'
  return null
}

function RecentActivityChip({ label }: { label?: string | null }) {
  if (!label) return null

  return (
    <span
      className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0"
      suppressHydrationWarning
    >
      {label}
    </span>
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

type ExpenseDisplayRow = {
  id: string
  expense: ExpenseWithDetails
  allocation?: ExpenseWithDetails['expense_allocations'][number]
  amount: number
  allocationIndex: number
  allocationCount: number
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

// ── Transfers List Report ─────────────────────────────────────────────────────

function TransfersListReport({ transfers, isSupervisor, onEdit, onDelete }: {
  transfers: TransferWithPart[]
  isSupervisor: boolean
  onEdit: (transfer: TransferWithPart) => void
  onDelete: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [sortByLog, setSortByLog] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const q = search.trim().toLowerCase()

  const rows = [...transfers]
    .filter(t => {
      if (!q) return true
      return (
        (t.from_person ?? '').toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const av = sortByLog ? (a.created_at ?? a.date) : a.date
      const bv = sortByLog ? (b.created_at ?? b.date) : b.date
      return bv.localeCompare(av)
    })

  const total = rows.reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by sender or notes…"
            className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X size={13} />
            </button>
          )}
        </div>
        <DateSortButton sortByLog={sortByLog} onToggle={() => setSortByLog(s => !s)} />
      </div>

      <SummaryCard
        label={search ? `Matching "${search}"` : 'Total Received'}
        value={`PKR ${formatPKR(total)}`}
        sub={`${rows.length} ${rows.length === 1 ? 'transfer' : 'transfers'} · by ${sortByLog ? 'log entry date' : 'transaction date'}`}
        color="#059669"
      />

      {rows.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">{search ? 'No results' : 'No transfers recorded'}</p>
      )}

      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {rows.map((t, i) => {
            const isExpanded = expandedId === t.id
            return (
              <div key={t.id} className={cn(i > 0 && 'border-t border-slate-100')}>
                <button
                  onClick={() => setExpandedId(prev => prev === t.id ? null : t.id)}
                  className="w-full px-4 py-3 flex items-start justify-between text-left"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <ArrowDownLeft size={17} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {t.project_parts && (
                          <span className="text-xs px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: t.project_parts.color }}>
                            {t.project_parts.short_name}
                          </span>
                        )}
                        <p className="text-sm font-medium text-slate-800 truncate">{t.from_person || 'Transfer received'}</p>
                      </div>
                      <div className="flex items-center gap-x-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={11} className="text-slate-300" />
                          {formatDate(t.date)}
                        </span>
                      </div>
                      {t.notes && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{t.notes}</p>}
                    </div>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1 flex-shrink-0">
                    <TodayChip date={t.date} />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-600">+PKR {formatPKR(Number(t.amount))}</span>
                      {isExpanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 pt-2 border-t border-slate-100 bg-slate-50">
                    <div className="space-y-1 text-xs text-slate-500 mb-3">
                      {t.project_parts && <p><span className="text-slate-400">Part:</span> {t.project_parts.name}</p>}
                      {t.from_person && <p><span className="text-slate-400">From:</span> {t.from_person}</p>}
                      <p><span className="text-slate-400">Amount:</span> PKR {formatPKR(Number(t.amount))}</p>
                      <p><span className="text-slate-400">Date:</span> {formatDate(t.date)}</p>
                      {t.notes && <p><span className="text-slate-400">Notes:</span> {t.notes}</p>}
                    </div>
                    {isSupervisor && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEdit(t)}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => onDelete(t.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
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

// ── Expenses List Report ──────────────────────────────────────────────────────

function ExpensesListReport({ expenses, selectedPart, isSupervisor, onEditExpense, onDeleteExpense }: {
  expenses: ExpenseWithDetails[]
  selectedPart?: ProjectPart
  isSupervisor: boolean
  onEditExpense: (expense: ExpenseWithDetails) => void
  onDeleteExpense: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [sortByLog, setSortByLog] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const q = search.trim().toLowerCase()

  const rows = getExpenseDisplayRows(expenses, selectedPart)
    .filter(row => {
      if (!q) return true
      const e = row.expense
      return (
        (e.description ?? '').toLowerCase().includes(q) ||
        (e.paid_to ?? '').toLowerCase().includes(q) ||
        (e.categories?.name ?? '').toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const av = sortByLog ? a.expense.created_at : a.expense.date
      const bv = sortByLog ? b.expense.created_at : b.expense.date
      return bv.localeCompare(av)
    })

  const totalShown = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-2.5">
      {/* Search + sort row */}
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
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X size={13} />
            </button>
          )}
        </div>
        <DateSortButton sortByLog={sortByLog} onToggle={() => setSortByLog(s => !s)} />
      </div>

      <SummaryCard
        label={search ? `Matching "${search}"` : 'Total Expenses'}
        value={`PKR ${formatPKR(totalShown)}`}
        sub={`${rows.length} ${rows.length === 1 ? 'expense' : 'expenses'} · by ${sortByLog ? 'log entry date' : 'transaction date'}`}
      />

      {rows.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">{search ? 'No results' : 'No expenses recorded'}</p>
      )}

      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {rows.map((row, i) => {
            const isExpanded = expandedId === row.id
            const allocs = row.expense.expense_allocations ?? []
            return (
              <div key={row.id} className={cn(i > 0 && 'border-t border-slate-100')}>
                <button
                  onClick={() => setExpandedId(prev => prev === row.id ? null : row.id)}
                  className="w-full px-4 py-3 flex items-start justify-between text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <ExpenseParts row={row} />
                      <LinkedExpenseTag row={row} />
                      <p className="text-sm font-medium text-slate-800 truncate">{row.expense.description || row.expense.categories?.name || 'Expense'}</p>
                    </div>
                    <ExpenseMeta expense={row.expense} />
                    <NotesList notes={row.expense.notes} />
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1 flex-shrink-0">
                    <TodayChip date={row.expense.date} />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-rose-500">PKR {formatPKR(row.amount)}</span>
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
                      <p><span className="text-slate-400">Date:</span> {formatDate(row.expense.date)}</p>
                      {row.expense.notes && <p><span className="text-slate-400">Notes:</span> {row.expense.notes}</p>}
                      {allocs.length > 1 && (
                        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2 mt-2">
                          <p className="text-xs font-semibold text-slate-500 mb-1.5">Allocated</p>
                          <div className="space-y-1">
                            {allocs.map(a => (
                              <div key={a.part_id} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 text-slate-600">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.project_parts?.color }} />
                                  {a.project_parts?.short_name ?? 'Part'}
                                </span>
                                <span className="font-semibold text-slate-700">PKR {formatPKR(Number(a.amount))}</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-slate-100">
                              <span className="text-blue-600 font-medium">Total</span>
                              <span className="text-blue-600 font-bold">PKR {formatPKR(row.expense.total_amount)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {isSupervisor && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onEditExpense(row.expense)}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => onDeleteExpense(row.expense.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
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
  const filteredRows = getExpenseDisplayRows(visiblePeople.flatMap(([, v]) => v.items), selectedPart)
    .sort((a, b) => b.expense.date.localeCompare(a.expense.date))

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
          ? `${filteredRows.length} transactions · ${subLabel}`
          : `${people.length} ${people.length === 1 ? 'person' : 'people'} · ${subLabel}`}
      />

      {people.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">No expenses recorded</p>
      )}

      {/* All-people view: expandable summary cards */}
      {!isFiltered && people.map(([name, { total, items }]) => (
        <PersonCard key={name} name={name} total={total} items={items} grandTotal={grandTotal} selectedPart={selectedPart} isSupervisor={isSupervisor} onEditExpense={onEditExpense} />
      ))}

      {/* Filtered view: flat transaction list */}
      {isFiltered && filteredRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredRows.map((row, i) => (
            <div key={row.id} className={cn('flex items-center justify-between px-4 py-3', i > 0 && 'border-t border-slate-100')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <ExpenseParts row={row} />
                  <LinkedExpenseTag row={row} />
                  <p className="text-sm font-medium text-slate-800 truncate">{row.expense.description || row.expense.categories?.name || 'Expense'}</p>
                </div>
                <ExpenseMeta expense={row.expense} showPerson={selectedPeople.size > 1} />
                <NotesList notes={row.expense.notes} />
              </div>
              <div className="ml-3 flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-sm font-bold text-rose-500">PKR {formatPKR(row.amount)}</span>
                {isSupervisor && (
                  <button onClick={() => onEditExpense(row.expense)} className="text-slate-400 active:text-blue-600" title="Edit expense" aria-label="Edit expense">
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

function PersonCard({ name, total, items, selectedPart, isSupervisor, onEditExpense }: {
  name: string; total: number; items: ExpenseWithDetails[]; grandTotal: number
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
          {getExpenseDisplayRows([...items].sort((a, b) => b.date.localeCompare(a.date)), selectedPart).map((row, i) => (
            <div key={row.id} className={cn('flex items-center justify-between px-4 py-2.5', i > 0 && 'border-t border-slate-50')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ExpenseParts row={row} />
                  <LinkedExpenseTag row={row} />
                  <p className="text-xs font-medium text-slate-700 truncate">{row.expense.description || row.expense.categories?.name || 'Expense'}</p>
                </div>
                <ExpenseMeta expense={row.expense} showPerson={false} />
                <NotesList notes={row.expense.notes} />
              </div>
              <div className="ml-2 flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs font-bold text-rose-500">PKR {formatPKR(row.amount)}</span>
                {isSupervisor && (
                  <button onClick={() => onEditExpense(row.expense)} className="text-slate-400 active:text-blue-600" title="Edit expense" aria-label="Edit expense">
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
    count: getExpenseDisplayRows(expenses.filter(e => e.category_id === c.id), selectedPart).length,
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
  const filteredRows = isFiltered
    ? getExpenseDisplayRows([...expenses.filter(e => selectedCats.has(e.category_id ?? ''))].sort((a, b) => b.date.localeCompare(a.date)), selectedPart)
    : []
  const filteredTotal = isFiltered
    ? filteredRows.reduce((s, row) => s + row.amount, 0)
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
          ? `${filteredRows.length} transactions · ${subLabel}`
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
        const rows = getExpenseDisplayRows(expenses.filter(e => e.category_id === cat.id).sort((a, b) => b.date.localeCompare(a.date)), selectedPart)
        const pct = totalOut > 0 ? (total / totalOut) * 100 : 0
        return (
          <CategoryCard key={cat.id} cat={cat} total={total} count={count} pct={pct} rows={rows} isSupervisor={isSupervisor} onEditExpense={onEditExpense} />
        )
      })}

      {/* Filtered view: flat transaction list grouped by category */}
      {isFiltered && filteredRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredRows.map((row, i) => (
            <div key={row.id} className={cn('flex items-center justify-between px-4 py-3', i > 0 && 'border-t border-slate-100')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <ExpenseParts row={row} />
                  <LinkedExpenseTag row={row} />
                  {selectedCats.size > 1 && row.expense.categories && (
                    <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: row.expense.categories.color }}>{row.expense.categories.name}</span>
                  )}
                  <p className="text-sm font-medium text-slate-800 truncate">{row.expense.description || row.expense.categories?.name || 'Expense'}</p>
                </div>
                <ExpenseMeta expense={row.expense} showCategory={selectedCats.size <= 1} />
                <NotesList notes={row.expense.notes} />
              </div>
              <div className="ml-3 flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-sm font-bold text-rose-500">PKR {formatPKR(row.amount)}</span>
                {isSupervisor && (
                  <button onClick={() => onEditExpense(row.expense)} className="text-slate-400 active:text-blue-600" title="Edit expense" aria-label="Edit expense">
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

function CategoryCard({ cat, total, count, pct, rows, isSupervisor, onEditExpense }: {
  cat: Category; total: number; count: number; pct: number
  rows: ExpenseDisplayRow[]
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
          {rows.map((row, i) => (
            <div key={row.id} className={cn('flex items-center justify-between px-4 py-2.5', i > 0 && 'border-t border-slate-50')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ExpenseParts row={row} />
                  <LinkedExpenseTag row={row} />
                  <p className="text-xs font-medium text-slate-700 truncate">{row.expense.description || cat.name}</p>
                </div>
                <ExpenseMeta expense={row.expense} showCategory={false} />
                <NotesList notes={row.expense.notes} />
              </div>
              <div className="ml-2 flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs font-bold text-rose-500">PKR {formatPKR(row.amount)}</span>
                {isSupervisor && (
                  <button onClick={() => onEditExpense(row.expense)} className="text-slate-400 active:text-blue-600" title="Edit expense" aria-label="Edit expense">
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

function RecentActivitySection({ scopeId, recentTab, onTabChange, expenseLimit, onExpenseLimitChange, expenses, transfers, deals }: {
  scopeId: string
  recentTab: RecentActivityTab
  onTabChange: (tab: RecentActivityTab) => void
  expenseLimit: number
  onExpenseLimitChange: (limit: number) => void
  expenses: RecentActivityItem[]
  transfers: RecentActivityItem[]
  deals: RecentActivityItem[]
}) {
  const recentExpenses = expenses.slice(0, expenseLimit)
  const recentTransfers = transfers.slice(0, 5)
  const recentDeals = deals.slice(0, 5)
  const recentItems = recentTab === 'expenses' ? recentExpenses : recentTab === 'transfers' ? recentTransfers : recentDeals
  const canLoadMoreExpenses = recentTab === 'expenses' && expenseLimit < Math.min(expenses.length, 10)
  const showExpenseMoreNote = recentTab === 'expenses' && expenseLimit >= 10 && expenses.length > 10
  const hasAnyActivity = expenses.length > 0 || transfers.length > 0 || deals.length > 0
  const tabs = [
    { id: 'expenses' as const, label: 'Expenses', count: Math.min(expenses.length, 10) },
    { id: 'transfers' as const, label: 'Transfers', count: recentTransfers.length },
    { id: 'deals' as const, label: 'Deals', count: recentDeals.length },
  ]

  if (!hasAnyActivity) return null

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-xs font-semibold text-slate-500">Recent Activity</p>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
          {tabs.map(item => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-semibold transition-colors',
                recentTab === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              )}
            >
              {item.label} {item.count}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {recentItems.length > 0 ? (
          recentItems.map((item, i) => {
            const Icon = item.icon
            return (
              <div key={item.id} className={cn('flex items-start justify-between gap-3 px-4 py-3', i > 0 && 'border-t border-slate-100')}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className={item.tone} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-300">{formatDate(item.date)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">{item.label}</p>
                    {item.notes && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.notes}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <RecentActivityChip label={item.activityLabel} />
                  <span className={cn('text-xs font-bold', item.tone)}>PKR {formatPKR(item.amount)}</span>
                </div>
              </div>
            )
          })
        ) : (
          <p className="px-4 py-5 text-sm text-slate-400">No recent {recentTab} for this {scopeId === 'all' ? 'view' : 'part'}.</p>
        )}

        {canLoadMoreExpenses && (
          <button
            onClick={() => onExpenseLimitChange(Math.min(expenseLimit + 5, 10))}
            className="w-full px-4 py-3 text-sm font-semibold text-blue-600 border-t border-slate-100 bg-blue-50/40 active:bg-blue-50"
          >
            Load more expenses
          </button>
        )}
        {showExpenseMoreNote && (
          <p className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100 bg-slate-50">
            Open the Expenses tab to see the full expense history.
          </p>
        )}
      </div>
    </>
  )
}

function PartsReport({ transfers, expenses, deals, parts, selectedPart }: {
  transfers: TransferWithPart[]
  expenses: ExpenseWithDetails[]
  deals: DealWithPart[]
  parts: ProjectPart[]
  selectedPart?: ProjectPart
}) {
  const [recentTab, setRecentTab] = useState<RecentActivityTab>('expenses')
  const [recentExpenseLimitState, setRecentExpenseLimitState] = useState({ partId: '', limit: 5 })
  const activityScopeId = selectedPart?.id ?? 'all'
  const recentExpenseLimit = recentExpenseLimitState.partId === activityScopeId ? recentExpenseLimitState.limit : 5
  const recentExpensesAll: RecentActivityItem[] = expenses.map(item => {
    const alloc = selectedPart ? item.expense_allocations.find(a => a.part_id === selectedPart.id) : undefined
    return {
      id: `expense-${item.id}`,
      label: item.description || item.categories?.name || 'Expense',
      date: item.date,
      activitySort: recentActivitySortValue(item.date, item.created_at, item.updated_at),
      activityLabel: recentActivityLabel(item.date, item.created_at, item.updated_at),
      notes: item.notes,
      amount: Number(alloc?.amount ?? item.total_amount),
      tone: 'text-rose-500',
      icon: TrendingDown,
    }
  }).sort((a, b) => b.activitySort - a.activitySort)
  const recentTransfersAll: RecentActivityItem[] = transfers.map(item => ({
    id: `transfer-${item.id}`,
    label: item.from_person || 'Transfer received',
    date: item.date,
    activitySort: recentActivitySortValue(item.date, item.created_at, item.updated_at),
    activityLabel: recentActivityLabel(item.date, item.created_at, item.updated_at),
    notes: item.notes,
    amount: Number(item.amount),
    tone: 'text-emerald-600',
    icon: ArrowDownToLine,
  })).sort((a, b) => b.activitySort - a.activitySort)
  const recentDealsAll: RecentActivityItem[] = deals.map(item => ({
    id: `deal-${item.id}`,
    label: item.name,
    date: item.date,
    activitySort: recentActivitySortValue(item.date, item.created_at, item.updated_at),
    activityLabel: recentActivityLabel(item.date, item.created_at, item.updated_at),
    notes: item.notes,
    amount: dealTotal(item),
    tone: 'text-blue-600',
    icon: Handshake,
  })).sort((a, b) => b.activitySort - a.activitySort)
  const recentActivity = (
    <RecentActivitySection
      scopeId={activityScopeId}
      recentTab={recentTab}
      onTabChange={setRecentTab}
      expenseLimit={recentExpenseLimit}
      onExpenseLimitChange={limit => setRecentExpenseLimitState({ partId: activityScopeId, limit })}
      expenses={recentExpensesAll}
      transfers={recentTransfersAll}
      deals={recentDealsAll}
    />
  )

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
    const spentPct = deposited > 0 ? Math.min((spent / deposited) * 100, 100) : 0
    const rawSpentPct = deposited > 0 ? (spent / deposited) * 100 : 0

    return (
      <div className="space-y-2.5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3" style={{ borderLeft: `3px solid ${selectedPart.color}` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">{selectedPart.name} Balance</p>
                <p className={cn('text-[26px] leading-tight font-bold mt-1', balance < 0 ? 'text-red-500' : 'text-emerald-600')}>
                  {balance < 0 ? '−' : ''}PKR {formatPKR(Math.abs(balance))}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{balance >= 0 ? 'remaining balance' : 'deficit'}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-lg text-white flex-shrink-0" style={{ backgroundColor: selectedPart.color }}>
                {selectedPart.short_name}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="min-w-0">
                <p className="text-slate-400">Received</p>
                <p className="font-semibold text-emerald-600 truncate">PKR {formatPKR(deposited)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-slate-400">Spent</p>
                <p className="font-semibold text-rose-500 truncate">PKR {formatPKR(spent)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-slate-400">{balance < 0 ? 'Deficit' : 'Remaining'}</p>
                <p className={cn('font-semibold truncate', balance < 0 ? 'text-red-500' : 'text-amber-600')}>PKR {formatPKR(Math.abs(balance))}</p>
              </div>
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
          <div className="bg-white rounded-2xl px-4 py-3 border border-slate-100 shadow-sm min-w-0">
            <p className="text-[11px] font-semibold text-slate-400">Top Expense</p>
            <p className="text-sm leading-snug font-medium text-slate-700 mt-1 line-clamp-2 break-words">
              {topExpense ? topExpense.expense.description || topExpense.expense.categories?.name || 'Expense' : '-'}
            </p>
            <p className="text-xs font-semibold text-rose-400 mt-1">{topExpense ? `PKR ${formatPKR(topExpense.amount)}` : 'none'}</p>
          </div>
          <div className="bg-white rounded-2xl px-4 py-3 border border-slate-100 shadow-sm min-w-0">
            <p className="text-[11px] font-semibold text-slate-400">Top Deal</p>
            <p className="text-sm leading-snug font-medium text-slate-700 mt-1 line-clamp-2 break-words">
              {topDeal ? topDeal.name : '-'}
            </p>
            <p className="text-xs font-semibold text-blue-500 mt-1">{topDeal ? `PKR ${formatPKR(dealTotal(topDeal))}` : 'none'}</p>
          </div>
        </div>

        {recentActivity}

        {recentExpensesAll.length === 0 && recentTransfersAll.length === 0 && recentDealsAll.length === 0 && spent === 0 && deposited === 0 && (
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
  const spentPct = totalDeposited > 0 ? Math.min((totalSpent / totalDeposited) * 100, 100) : 0

  return (
    <div className="space-y-2.5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Overall Balance</p>
              <p className={cn('text-3xl font-bold mt-1', totalBalance < 0 ? 'text-red-500' : 'text-emerald-600')}>
                {totalBalance < 0 ? '−' : ''}PKR {formatPKR(Math.abs(totalBalance))}
              </p>
              <p className="text-xs text-slate-400 mt-1">{totalBalance >= 0 ? 'cash remaining across all parts' : 'deficit across all parts'}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold',
                totalBalance < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              )}>
                <Scale size={11} />
                {totalBalance < 0 ? 'Deficit' : 'Net positive'}
              </span>
              <p className="text-xs text-slate-400 mt-1">{activeParts} active part{activeParts !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${spentPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
            <span>{totalDeposited > 0 ? `${(totalSpent / totalDeposited * 100).toFixed(0)}% spent` : 'No received funds yet'}</span>
            <span>PKR {formatPKR(totalSpent)} spent</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {summaries.map(({ part, deposited, spent, balance }) => (
          <div key={part.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-3 py-3.5" style={{ borderTop: `3px solid ${part.color}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{part.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{part.short_name}</p>
                </div>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: part.color }} />
              </div>
              <p className={cn('text-base font-bold mt-3', balance >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {balance < 0 ? '−' : ''}PKR {formatPKR(Math.abs(balance))}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{balance >= 0 ? 'remaining' : 'deficit'}</p>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400">In</span>
                  <span className="font-semibold text-emerald-600">PKR {formatPKR(deposited)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400">Out</span>
                  <span className="font-semibold text-rose-500">PKR {formatPKR(spent)}</span>
                </div>
              </div>
            </div>
            <div className="px-3 pb-3">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width: `${deposited > 0 ? Math.min((spent / deposited) * 100, 100) : 0}%`, backgroundColor: part.color }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {deposited > 0 ? `${((spent / deposited) * 100).toFixed(0)}% spent` : 'No deposits yet'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="Transfers" value={String(transferCount)} sub="received" />
        <SummaryCard label="Expenses" value={String(expenseCount)} sub="paid out" />
        <SummaryCard label="Deals" value={String(deals.length)} sub="contracts" />
      </div>
    </div>
  )
}

// ── Deals Report ──────────────────────────────────────────────────────────────

function DealsReport({ deals, expenses, paidMap, selectedPart, isSupervisor, onAddScope, onEditDeal, onEditRevision, onDeleteDeal }: {
  deals: DealWithPart[]
  expenses: ExpenseWithDetails[]
  paidMap: Record<string, Record<string, number>>
  selectedPart?: ProjectPart
  isSupervisor: boolean
  onAddScope: (deal: DealWithPart) => void
  onEditDeal: (deal: DealWithPart) => void
  onEditRevision: (deal: DealWithPart, revision: DealRevision) => void
  onDeleteDeal: (id: string) => void
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
            onDeleteDeal={onDeleteDeal}
          />
        )
      })}
    </div>
  )
}

function DealPersonCard({ name, agreed, paid, remaining, groups, expenses, isSupervisor, onAddScope, onEditDeal, onEditRevision, onDeleteDeal }: {
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
  onDeleteDeal: (id: string) => void
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
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays size={11} className="text-slate-300" />
                              {formatDate(d.date)}
                            </span>
                          </div>
                          <NotesList notes={d.notes} className="text-[11px]" />
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
                              <button onClick={() => onDeleteDeal(d.id)} className="text-slate-400 active:text-red-600" title="Delete deal">
                                <Trash2 size={13} />
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
                              <div className="flex items-center gap-1.5 flex-wrap text-slate-400">
                                <span>{formatDate(revision.date)}</span>
                              </div>
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
                                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                                  <span>{formatDate(e.date)}</span>
                                </div>
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
