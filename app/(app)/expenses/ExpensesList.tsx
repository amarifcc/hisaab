'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, TrendingDown, ChevronDown, Check, CalendarDays, UserRound } from 'lucide-react'
import { formatPKR, formatDate, fmtRef, cn } from '@/lib/utils'
import ExpenseSheet from '@/components/ExpenseSheet'
import NotesList from '@/components/NotesList'
import type { ProjectPart, Category, Expense, ExpenseAllocation } from '@/lib/types'

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

type ExpenseAllocationRow = ExpenseAllocation & { project_parts: ProjectPart }
type ExpenseListRow = ExpenseWithDetails & {
  _rowId: string
  _allocation: ExpenseAllocationRow | null
  _displayAmount: number
  _isLinkedAllocation: boolean
}

export default function ExpensesList({ initialExpenses, parts, categories, isSupervisor }: Props) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseWithDetails | null>(null)
  const [filterPart, setFilterPart] = useState<string>('all')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const catDropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const saved = localStorage.getItem(PART_FILTER_KEY)
    if (saved) setFilterPart(saved)
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setCatDropdownOpen(false)
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
  const selectedCat = categories.find(c => c.id === filterCat)
  const catGroups = categories.filter(c => c.is_group)
  const catGroupIds = new Set(catGroups.map(g => g.id))
  const ungroupedCats = categories.filter(c => !c.is_group && (c.parent_id === null || !catGroupIds.has(c.parent_id ?? '')))

  const filtered = expenses.filter(e => {
    const partMatch = filterPart === 'all' || e.expense_allocations.some(a => a.part_id === filterPart)
    const catMatch = filterCat === 'all' || e.category_id === filterCat
    return partMatch && catMatch
  })

  const rows: ExpenseListRow[] = filtered.flatMap<ExpenseListRow>(e => {
    const allocs = e.expense_allocations
    const visibleAllocs = filterPart === 'all'
      ? allocs
      : allocs.filter(a => a.part_id === filterPart)
    if (allocs.length <= 1) {
      const allocation = visibleAllocs[0] ?? allocs[0] ?? null
      return [{
        ...e,
        _rowId: `expense-${e.id}`,
        _allocation: allocation,
        _displayAmount: allocation ? Number(allocation.amount) : Number(e.total_amount),
        _isLinkedAllocation: false,
      }]
    }
    return visibleAllocs.map(allocation => ({
      ...e,
      _rowId: `expense-${e.id}-${allocation.part_id}`,
      _allocation: allocation,
      _displayAmount: Number(allocation.amount),
      _isLinkedAllocation: true,
    }))
  })

  const totalFiltered = filtered.reduce((s, e) => {
    if (filterPart === 'all') return s + e.total_amount
    const alloc = e.expense_allocations.find(a => a.part_id === filterPart)
    return s + (alloc?.amount ?? 0)
  }, 0)

  function handleSaved(data: ExpenseWithDetails) {
    if (editing) {
      setExpenses(prev => prev.map(e => e.id === data.id ? data : e))
    } else {
      setExpenses(prev => [data, ...prev])
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    const res = await fetch('/api/expenses', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
    if (res.ok) setExpenses(prev => prev.filter(e => e.id !== id))
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

      {/* Category filter dropdown */}
      <div className="mb-4" ref={catDropdownRef}>
        <div className="relative inline-block">
          <button
            onClick={() => setCatDropdownOpen(o => !o)}
            className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
          >
            {selectedCat && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedCat.color }} />}
            {selectedCat ? selectedCat.name : 'All Categories'}
            <ChevronDown size={13} className={cn('transition-transform', catDropdownOpen && 'rotate-180')} />
          </button>

          {catDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[200px] overflow-hidden max-h-72 overflow-y-auto">
              <button
                onClick={() => { setFilterCat('all'); setCatDropdownOpen(false) }}
                className={cn('w-full text-left px-4 py-3 text-sm font-medium flex items-center justify-between transition-colors',
                  filterCat === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')}
              >
                All Categories
                {filterCat === 'all' && <Check size={14} />}
              </button>

              {catGroups.map(group => {
                const children = categories.filter(c => c.parent_id === group.id)
                return (
                  <div key={group.id}>
                    <div className="px-4 pt-2 pb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{group.name}</span>
                    </div>
                    {children.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setFilterCat(c.id); setCatDropdownOpen(false) }}
                        className={cn('w-full text-left pl-8 pr-4 py-2.5 text-sm flex items-center justify-between transition-colors',
                          filterCat === c.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50')}
                      >
                        {c.name}
                        {filterCat === c.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )
              })}

              {ungroupedCats.length > 0 && (
                <div>
                  {catGroups.length > 0 && (
                    <div className="px-4 pt-2 pb-1">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Other</span>
                    </div>
                  )}
                  {ungroupedCats.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setFilterCat(c.id); setCatDropdownOpen(false) }}
                      className={cn('w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors',
                        filterCat === c.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50')}
                    >
                      {c.name}
                      {filterCat === c.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-10">No expenses</p>
        )}
        {rows.map(e => {
          const allocs = e.expense_allocations
          const displayAllocs = e._allocation ? [e._allocation] : (filterPart === 'all'
            ? allocs
            : allocs.filter(a => a.part_id === filterPart))
          const displayAmount = e._displayAmount
          const allocationIndex = e._isLinkedAllocation && e._allocation
            ? allocs.findIndex(a => a.part_id === e._allocation?.part_id) + 1
            : 0
          const category = e.categories
          const showCategoryChip = category ? category.name !== (e.description || '') : false
          const categoryMeta = category && category.name !== (e.description || '') ? ` · ${category.name}` : ''

          return (
            <div key={e._rowId} className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                    <TrendingDown size={18} className="text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{e.description || e.categories?.name || 'Expense'}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {displayAllocs.map(a => (
                        <span key={a.part_id} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: a.project_parts?.color }}>
                          {a.project_parts?.short_name}
                        </span>
                      ))}
                      {e._isLinkedAllocation && (
                        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          linked {allocationIndex} of {allocs.length}
                        </span>
                      )}
                      {showCategoryChip && category && (
                        <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: category.color }}>
                          {category.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-400">
                      {e.ref_number ? <span className="font-mono">{fmtRef('EXP', e.ref_number)}</span> : null}
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={11} className="text-slate-300" />
                        {formatDate(e.date)}
                      </span>
                      {e.paid_to && (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <UserRound size={11} className="text-slate-300 flex-shrink-0" />
                          <span className="truncate">{e.paid_to}</span>
                        </span>
                      )}
                      {!showCategoryChip && categoryMeta && <span>{categoryMeta.replace(' · ', '')}</span>}
                      {e._isLinkedAllocation ? <span>linked total PKR {formatPKR(e.total_amount)}</span> : ''}
                    </div>
                    <NotesList notes={e.notes} />
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
        onSaved={handleSaved}
        parts={parts}
        categories={categories}
        editing={editing}
      />
    </div>
  )
}
