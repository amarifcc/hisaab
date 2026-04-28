'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, TrendingDown, ChevronDown } from 'lucide-react'
import { formatPKR, formatDate, cn } from '@/lib/utils'
import ExpenseSheet from '@/components/ExpenseSheet'
import type { ProjectPart, Category, Expense, ExpenseAllocation } from '@/lib/types'
import { useRouter } from 'next/navigation'

type ExpenseWithDetails = Expense & {
  categories: Category | null
  expense_allocations: (ExpenseAllocation & { project_parts: ProjectPart })[]
}

interface Props {
  initialExpenses: ExpenseWithDetails[]
  parts: ProjectPart[]
  categories: Category[]
  isSupervisor: boolean
}

const PART_FILTER_KEY = 'hisab_expenses_filter_part'

export default function ExpensesList({ initialExpenses, parts, categories, isSupervisor }: Props) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseWithDetails | null>(null)
  const [filterPart, setFilterPart] = useState<string>('all')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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

  const filtered = expenses.filter(e => {
    const partMatch = filterPart === 'all' || e.expense_allocations.some(a => a.part_id === filterPart)
    const catMatch = filterCat === 'all' || e.category_id === filterCat
    return partMatch && catMatch
  })

  const totalFiltered = filtered.reduce((s, e) => {
    if (filterPart === 'all') return s + e.total_amount
    const alloc = e.expense_allocations.find(a => a.part_id === filterPart)
    return s + (alloc?.amount ?? 0)
  }, 0)

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    await fetch('/api/expenses', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
    setExpenses(prev => prev.filter(e => e.id !== id))
    router.refresh()
  }

  return (
    <div className="px-4 pt-5 pb-4">

      {/* Header row: title + part dropdown + add button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Expenses</h1>
            <p className="text-xs text-slate-400">PKR {formatPKR(totalFiltered)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Part dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              {selectedPart && (
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedPart.color }} />
              )}
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

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterCat('all')}
          className={cn('flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
            filterCat === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}
        >
          All
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setFilterCat(prev => prev === c.id ? 'all' : c.id)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={filterCat === c.id
              ? { backgroundColor: c.color, color: '#fff', borderColor: c.color }
              : { backgroundColor: '#fff', color: '#475569', borderColor: '#e2e8f0' }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-10">No expenses</p>
        )}
        {filtered.map(e => {
          const allocs = e.expense_allocations
          const displayAllocs = filterPart === 'all'
            ? allocs
            : allocs.filter(a => a.part_id === filterPart)
          const displayAmount = filterPart === 'all'
            ? e.total_amount
            : (allocs.find(a => a.part_id === filterPart)?.amount ?? e.total_amount)

          return (
            <div key={e.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                    <TrendingDown size={18} className="text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{e.description || e.categories?.name || 'Expense'}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {e.categories && (
                        <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: e.categories.color }}>
                          {e.categories.name}
                        </span>
                      )}
                      {displayAllocs.map(a => (
                        <span key={a.part_id} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: a.project_parts?.color }}>
                          {a.project_parts?.short_name} {formatPKR(a.amount)}
                        </span>
                      ))}
                      {allocs.length > 1 && filterPart === 'all' && (
                        <span className="text-xs text-slate-400">split</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(e.date)}{e.paid_to ? ` · ${e.paid_to}` : ''}
                    </p>
                    {e.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{e.notes}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                  <span className="text-rose-500 font-bold text-sm">PKR {formatPKR(displayAmount)}</span>
                  {isSupervisor && (
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(e); setSheetOpen(true) }} className="text-slate-400 active:text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(e.id)} className="text-slate-400 active:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <ExpenseSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={() => router.refresh()}
        parts={parts}
        categories={categories}
        editing={editing}
      />
    </div>
  )
}
