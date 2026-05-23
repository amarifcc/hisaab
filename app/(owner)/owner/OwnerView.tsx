'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, CalendarDays, Receipt } from 'lucide-react'
import ExpenseSheet from '@/components/ExpenseSheet'
import { formatPKR, formatDate } from '@/lib/utils'
import type { ProjectPart, Category, ExpenseWithDetails } from '@/lib/types'

interface Props {
  part: ProjectPart
  categories: Category[]
  initialExpenses: ExpenseWithDetails[]
}

export default function OwnerView({ part, categories, initialExpenses }: Props) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseWithDetails | null>(null)

  const total = expenses.reduce((s, e) => s + Number(e.total_amount), 0)

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
    <div className="px-4 pt-5 pb-24">
      {/* Summary */}
      <div className="rounded-2xl px-4 py-5 mb-5 text-white" style={{ backgroundColor: part.color }}>
        <p className="text-xs font-medium opacity-80">My direct spend · {part.name}</p>
        <p className="text-2xl font-bold mt-1">PKR {formatPKR(total)}</p>
        <p className="text-xs opacity-80 mt-1">
          {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
        </p>
      </div>

      {/* List */}
      {expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-4 py-12 text-center">
          <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No expenses yet. Tap + to add what you&apos;ve paid for directly.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(e => (
            <div key={e.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {e.categories && (
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.categories.color }} />
                    )}
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {e.categories?.name ?? e.description}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                    {e.paid_to && <span className="truncate">{e.paid_to}</span>}
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={11} className="text-slate-300" />
                      {formatDate(e.date)}
                    </span>
                  </div>
                  {e.notes && <p className="text-[11px] text-slate-400 mt-1">{e.notes}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-slate-900">PKR {formatPKR(Number(e.total_amount))}</span>
                  <button
                    onClick={() => { setEditing(e); setSheetOpen(true) }}
                    className="text-slate-400 active:text-blue-600"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="text-slate-400 active:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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
