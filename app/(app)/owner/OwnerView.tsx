'use client'

import { useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  List,
  Pencil,
  Plus,
  Receipt,
  Search,
  Tag,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import ExpenseSheet from '@/components/ExpenseSheet'
import InfoTooltip from '@/components/InfoTooltip'
import NotesList from '@/components/NotesList'
import ShareMeter from '@/components/ShareMeter'
import { confirmTypedDelete } from '@/lib/confirm-delete'
import { formatPKR, formatDate, cn } from '@/lib/utils'
import type { ProjectPart, Category, ExpenseWithDetails } from '@/lib/types'

interface Props {
  part: ProjectPart
  categories: Category[]
  initialExpenses: ExpenseWithDetails[]
}

type OwnerTab = 'overview' | 'expenses' | 'categories'
type CategorySummary = {
  id: string
  name: string
  color: string
  amount: number
  count: number
  expenses: ExpenseWithDetails[]
}

function pktYearMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  return y && m ? `${y}-${m}` : new Date().toISOString().slice(0, 7)
}

export default function OwnerView({ part, categories, initialExpenses }: Props) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [tab, setTab] = useState<OwnerTab>('overview')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseWithDetails | null>(null)

  const total = expenses.reduce((s, e) => s + Number(e.total_amount), 0)
  const ym = pktYearMonth()
  const thisMonth = expenses.filter(e => e.date?.startsWith(ym)).reduce((s, e) => s + Number(e.total_amount), 0)
  const categorySummaries = useMemo(() => buildCategorySummaries(expenses, categories), [expenses, categories])
  const topCategory = categorySummaries[0]

  function openAdd() {
    setEditing(null)
    setSheetOpen(true)
  }

  function handleSaved(data: ExpenseWithDetails) {
    setExpenses(prev => editing ? prev.map(x => (x.id === data.id ? data : x)) : [data, ...prev])
    setEditing(null)
  }

  async function handleDelete(expense: ExpenseWithDetails) {
    if (!confirmTypedDelete('Delete this owner expense?')) return
    const res = await fetch('/api/expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: expense.id }),
    })
    if (res.ok) setExpenses(prev => prev.filter(x => x.id !== expense.id))
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Wallet },
    { id: 'expenses' as const, label: 'Expenses', icon: List },
    { id: 'categories' as const, label: 'Categories', icon: Tag },
  ]

  return (
    <div className="px-4 pt-5 pb-24">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 truncate">Owner Home</h1>
            <InfoTooltip
              label="Owner Home info"
              text={`Track expenses you paid directly for ${part.name}. These are separate from supervisor-managed money and feed Joint Home.`}
            />
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
            <span className="text-xs px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: part.color }}>
              {part.short_name}
            </span>
            <span className="truncate">{part.name}</span>
          </div>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium shadow-sm bg-blue-700 text-white flex-shrink-0"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      <div className="flex gap-1.5 mb-4 bg-slate-100 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            )}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {tab === 'overview' && (
          <OwnerOverview
            part={part}
            total={total}
            thisMonth={thisMonth}
            expenseCount={expenses.length}
            topCategory={topCategory}
          />
        )}
        {tab === 'expenses' && (
          <OwnerExpensesList
            expenses={expenses}
            onEdit={expense => { setEditing(expense); setSheetOpen(true) }}
            onDelete={handleDelete}
          />
        )}
        {tab === 'categories' && (
          <OwnerCategoriesReport
            categories={categorySummaries}
            total={total}
            onEdit={expense => { setEditing(expense); setSheetOpen(true) }}
          />
        )}
      </div>

      <ExpenseSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditing(null) }}
        onSaved={handleSaved}
        parts={[part]}
        categories={categories}
        editing={editing}
        lockedPartId={part.id}
        source="owner"
        hideDealContext
      />
    </div>
  )
}

function OwnerOverview({ part, total, thisMonth, expenseCount, topCategory }: {
  part: ProjectPart
  total: number
  thisMonth: number
  expenseCount: number
  topCategory?: CategorySummary
}) {
  return (
    <div className="space-y-2.5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-4" style={{ borderLeft: `3px solid ${part.color}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Owner-direct spend</p>
              <p className="text-3xl font-bold mt-1 text-slate-900">PKR {formatPKR(total)}</p>
              <p className="text-xs text-slate-400 mt-1">{expenseCount} expense{expenseCount !== 1 ? 's' : ''} on {part.name}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-lg text-white flex-shrink-0" style={{ backgroundColor: part.color }}>
              {part.short_name}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <Stat label="This month" value={thisMonth} tone="blue" />
          <Stat label="Top category" value={topCategory?.amount ?? 0} sub={topCategory?.name ?? 'None'} />
        </div>
      </div>

      {expenseCount === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-12 text-center">
          <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">No owner expenses yet</p>
          <p className="text-xs text-slate-400 mt-1">Use Add to record direct spend for this part.</p>
        </div>
      )}
    </div>
  )
}

function OwnerExpensesList({ expenses, onEdit, onDelete }: {
  expenses: ExpenseWithDetails[]
  onEdit: (expense: ExpenseWithDetails) => void
  onDelete: (expense: ExpenseWithDetails) => void
}) {
  const [search, setSearch] = useState('')
  const [sortByLog, setSortByLog] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const q = search.trim().toLowerCase()

  const rows = [...expenses]
    .filter(e => {
      if (!q) return true
      return (
        (e.description ?? '').toLowerCase().includes(q) ||
        (e.paid_to ?? '').toLowerCase().includes(q) ||
        (e.categories?.name ?? '').toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const av = sortByLog ? (a.created_at ?? a.date) : a.date
      const bv = sortByLog ? (b.created_at ?? b.date) : b.date
      return bv.localeCompare(av)
    })

  const total = rows.reduce((s, e) => s + Number(e.total_amount), 0)

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search description, person, category..."
            className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        <DateSortButton sortByLog={sortByLog} onToggle={() => setSortByLog(s => !s)} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
        <p className="text-xs text-slate-400 font-medium">{search ? `Matching "${search}"` : 'Owner Expenses'}</p>
        <p className="text-lg font-bold mt-0.5 text-slate-900">PKR {formatPKR(total)}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {rows.length} {rows.length === 1 ? 'expense' : 'expenses'} · by {sortByLog ? 'log entry date' : 'transaction date'}
        </p>
      </div>

      {rows.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">{search ? 'No results' : 'No owner expenses recorded'}</p>
      )}

      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {rows.map((expense, i) => {
            const expanded = expandedId === expense.id
            return (
              <div key={expense.id} className={cn(i > 0 && 'border-t border-slate-100')}>
                <button
                  onClick={() => setExpandedId(prev => prev === expense.id ? null : expense.id)}
                  className="w-full px-4 py-3 flex items-start justify-between text-left"
                >
                  <ExpenseSummary expense={expense} />
                  <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold text-rose-500">PKR {formatPKR(Number(expense.total_amount))}</span>
                    {expanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-3 pt-2 border-t border-slate-100 bg-slate-50">
                    <ExpenseDetails expense={expense} />
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => onEdit(expense)} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => onDelete(expense)} className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                        <Trash2 size={12} /> Delete
                      </button>
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

function OwnerCategoriesReport({ categories, total, onEdit }: {
  categories: CategorySummary[]
  total: number
  onEdit: (expense: ExpenseWithDetails) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-2.5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
        <p className="text-xs text-slate-400 font-medium">Category Spend</p>
        <p className="text-lg font-bold mt-0.5 text-slate-900">PKR {formatPKR(total)}</p>
        <p className="text-xs text-slate-400 mt-0.5">{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</p>
      </div>

      {categories.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">No owner expenses recorded</p>
      )}

      {categories.map(category => {
        const expanded = expandedId === category.id
        return (
          <div key={category.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button className="w-full px-4 py-3.5 text-left" onClick={() => setExpandedId(prev => prev === category.id ? null : category.id)}>
              <CategoryHeader category={category} total={total} />
            </button>
            {expanded && (
              <div className="border-t border-slate-100">
                {[...category.expenses].sort((a, b) => b.date.localeCompare(a.date)).map((expense, i) => (
                  <div key={expense.id} className={cn('flex items-start justify-between px-4 py-2.5', i > 0 && 'border-t border-slate-50')}>
                    <ExpenseSummary expense={expense} compact />
                    <div className="ml-2 flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs font-bold text-rose-500">PKR {formatPKR(Number(expense.total_amount))}</span>
                      <button onClick={() => onEdit(expense)} className="text-slate-400 active:text-blue-600" title="Edit expense" aria-label="Edit expense">
                        <Pencil size={12} />
                      </button>
                    </div>
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

function ExpenseSummary({ expense, compact = false }: { expense: ExpenseWithDetails; compact?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
        {expense.categories && (
          <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: expense.categories.color }}>
            {expense.categories.name}
          </span>
        )}
        <p className={cn(compact ? 'text-xs' : 'text-sm', 'font-medium text-slate-800 truncate')}>
          {expense.description || expense.categories?.name || 'Expense'}
        </p>
      </div>
      <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-400">
        {expense.paid_to && (
          <span className="inline-flex items-center gap-1 min-w-0">
            <UserRound size={11} className="text-slate-300 flex-shrink-0" />
            <span className="truncate">{expense.paid_to}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={11} className="text-slate-300" />
          {formatDate(expense.date)}
        </span>
      </div>
      <NotesList notes={expense.notes} />
    </div>
  )
}

function ExpenseDetails({ expense }: { expense: ExpenseWithDetails }) {
  return (
    <div className="space-y-1 text-xs text-slate-500">
      {expense.description && <p><span className="text-slate-400">Description:</span> {expense.description}</p>}
      {expense.categories && <p><span className="text-slate-400">Category:</span> {expense.categories.name}</p>}
      {expense.paid_to && <p><span className="text-slate-400">Paid to:</span> {expense.paid_to}</p>}
      <p><span className="text-slate-400">Amount:</span> PKR {formatPKR(Number(expense.total_amount))}</p>
      <p><span className="text-slate-400">Date:</span> {formatDate(expense.date)}</p>
      {expense.notes && <p><span className="text-slate-400">Notes:</span> {expense.notes}</p>}
    </div>
  )
}

function CategoryHeader({ category, total }: { category: CategorySummary; total: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
          <span className="text-sm font-semibold text-slate-800 truncate">{category.name}</span>
          <span className="text-xs text-slate-400 flex-shrink-0">{category.count} txn</span>
        </div>
        <span className="text-sm font-bold text-slate-800 flex-shrink-0 ml-2">PKR {formatPKR(category.amount)}</span>
      </div>
      <ShareMeter percent={total > 0 ? (category.amount / total) * 100 : 0} color={category.color} />
    </div>
  )
}

function Stat({ label, value, tone, sub }: { label: string; value: number; tone?: 'blue'; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 min-w-0">
      <p className="text-[11px] text-slate-400 truncate">{label}</p>
      <p className={cn('text-sm font-bold mt-0.5 truncate', tone === 'blue' ? 'text-blue-600' : 'text-slate-800')}>
        PKR {formatPKR(value)}
      </p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
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

function buildCategorySummaries(expenses: ExpenseWithDetails[], categories: Category[]): CategorySummary[] {
  const map = new Map<string, CategorySummary>()
  for (const expense of expenses) {
    const id = expense.category_id ?? '__none__'
    const category = categories.find(c => c.id === id)
    const cur = map.get(id) ?? {
      id,
      name: expense.categories?.name ?? category?.name ?? 'Uncategorized',
      color: expense.categories?.color ?? category?.color ?? '#94a3b8',
      amount: 0,
      count: 0,
      expenses: [],
    }
    cur.amount += Number(expense.total_amount)
    cur.count += 1
    cur.expenses.push(expense)
    map.set(id, cur)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}
