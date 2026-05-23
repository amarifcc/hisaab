'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, CalendarDays, Receipt } from 'lucide-react'
import ExpenseSheet from '@/components/ExpenseSheet'
import ShareMeter from '@/components/ShareMeter'
import InfoTooltip from '@/components/InfoTooltip'
import NotesList from '@/components/NotesList'
import { formatPKR, formatDate, cn } from '@/lib/utils'
import type { ProjectPart, Category, ExpenseWithDetails } from '@/lib/types'

interface Props {
  part: ProjectPart
  categories: Category[]
  initialExpenses: ExpenseWithDetails[]
}

// Current year-month in PKT (Asia/Karachi), e.g. "2026-05".
function pktYearMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  return y && m ? `${y}-${m}` : new Date().toISOString().slice(0, 7)
}

export default function OwnerView({ part, categories, initialExpenses }: Props) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseWithDetails | null>(null)

  const total = expenses.reduce((s, e) => s + Number(e.total_amount), 0)
  const ym = pktYearMonth()
  const thisMonth = expenses.filter(e => e.date?.startsWith(ym)).reduce((s, e) => s + Number(e.total_amount), 0)

  // Category breakdown (owner expenses are single-part, so total_amount == this part's amount).
  const catMap = new Map<string, { name: string; color: string; amount: number; count: number }>()
  for (const e of expenses) {
    const id = e.category_id ?? '__none__'
    const cur = catMap.get(id) ?? {
      name: e.categories?.name ?? 'Uncategorized',
      color: e.categories?.color ?? '#94a3b8',
      amount: 0,
      count: 0,
    }
    cur.amount += Number(e.total_amount)
    cur.count += 1
    catMap.set(id, cur)
  }
  const cats = [...catMap.values()].sort((a, b) => b.amount - a.amount)
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date))

  function handleSaved(data: ExpenseWithDetails) {
    setExpenses(prev => (editing ? prev.map(x => (x.id === data.id ? data : x)) : [data, ...prev]))
    setEditing(null)
  }

  async function handleDelete(id: string) {
    const res = await fetch('/api/expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setExpenses(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div className="px-4 pt-5 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900">My Expenses</h1>
        <InfoTooltip
          label="My Expenses info"
          text={`Expenses you paid for directly on ${part.name} — separate from money handled by the supervisor. These feed your Combined Report.`}
        />
      </div>

      {/* Hero — direct spend for this part */}
      <div className="rounded-2xl px-4 py-5 text-white shadow-sm" style={{ backgroundColor: part.color }}>
        <p className="text-xs font-medium opacity-80">My direct spend · {part.name}</p>
        <p className="text-3xl font-bold mt-1">PKR {formatPKR(total)}</p>
        <div className="flex items-center gap-4 mt-2 text-xs opacity-90">
          <span>{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</span>
          <span>This month <span className="font-semibold">PKR {formatPKR(thisMonth)}</span></span>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-12 text-center">
          <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">No expenses yet</p>
          <p className="text-xs text-slate-400 mt-1">Tap the + button to add what you&apos;ve paid for directly.</p>
        </div>
      ) : (
        <>
          {/* By category */}
          <section>
            <p className="text-sm font-semibold text-slate-700 mb-2">By category</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {cats.map((c, i) => (
                <div key={c.name + i} className={cn('px-4 py-3', i > 0 && 'border-t border-slate-100')}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="text-sm font-semibold text-slate-800 truncate">{c.name}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0">{c.count} txn</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800 flex-shrink-0 ml-2">PKR {formatPKR(c.amount)}</span>
                  </div>
                  <ShareMeter percent={total > 0 ? (c.amount / total) * 100 : 0} color={c.color} />
                </div>
              ))}
            </div>
          </section>

          {/* Expenses list */}
          <section>
            <p className="text-sm font-semibold text-slate-700 mb-2">Expenses</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {sorted.map((e, i) => (
                <div key={e.id} className={cn('flex items-start justify-between px-4 py-3', i > 0 && 'border-t border-slate-100')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {e.categories && (
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.categories.color }} />
                      )}
                      <p className="text-sm font-medium text-slate-800 truncate">{e.categories?.name ?? e.description}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-400">
                      {e.paid_to && <span className="truncate">{e.paid_to}</span>}
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={11} className="text-slate-300" />
                        {formatDate(e.date)}
                      </span>
                    </div>
                    <NotesList notes={e.notes} />
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-sm font-bold text-rose-500">PKR {formatPKR(Number(e.total_amount))}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditing(e); setSheetOpen(true) }} className="text-slate-400 active:text-blue-600" title="Edit" aria-label="Edit expense">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(e.id)} className="text-slate-400 active:text-red-600" title="Delete" aria-label="Delete expense">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => { setEditing(null); setSheetOpen(true) }}
        className="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-blue-700 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-30"
        aria-label="Add expense"
      >
        <Plus size={26} />
      </button>

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
