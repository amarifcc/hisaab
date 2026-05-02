'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, ReceiptText, ArrowDownToLine, ArrowDownLeft, TrendingDown, ChevronDown, ChevronUp, Clock, Pencil, Trash2, Search, X } from 'lucide-react'
import { formatPKR, formatDate, fmtRef, cn } from '@/lib/utils'
import TransferSheet from '@/components/TransferSheet'
import ExpenseSheet from '@/components/ExpenseSheet'
import type { ProjectPart, Category } from '@/lib/types'

type AnyTransfer = Record<string, any>
type AnyExpense = Record<string, any>
type AnyAllocation = { part_id: string; amount: number; project_parts?: ProjectPart }
type TransactionFilter = 'expenses' | 'transfers'

interface Props {
  parts: ProjectPart[]
  transfers: AnyTransfer[]
  expenses: AnyExpense[]
  isSupervisor: boolean
  embedded?: boolean
}

const FILTER_KEY = 'hisab_transactions_filter_part'
const LEGACY_FILTER_KEY = 'hisab_filter_part'

export default function TransactionsView({ parts, transfers: initialTransfers, expenses: initialExpenses, isSupervisor, embedded = false }: Props) {
  const [localTransfers, setLocalTransfers] = useState(initialTransfers)
  const [localExpenses, setLocalExpenses] = useState(initialExpenses)
  const [filterPart, setFilterPart] = useState<string>('all')
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('expenses')
  const [filterOpen, setFilterOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [sortByLog, setSortByLog] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')

  const [transferSheetOpen, setTransferSheetOpen] = useState(false)
  const [editingTransfer, setEditingTransfer] = useState<AnyTransfer | null>(null)
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<AnyExpense | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    const saved = localStorage.getItem(FILTER_KEY) ?? localStorage.getItem(LEGACY_FILTER_KEY)
    if (saved) setFilterPart(saved)
  }, [])

  useEffect(() => {
    fetch('/api/categories-list').then(r => r.json()).then(d => setCategories(d ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function changeFilter(val: string) {
    setFilterPart(val)
    localStorage.setItem(FILTER_KEY, val)
    setFilterOpen(false)
  }

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  async function handleDeleteTransfer(id: string, fromPerson: string, amount: number) {
    if (!confirm(`Delete transfer of PKR ${formatPKR(amount)} from ${fromPerson || 'unknown'}? This cannot be undone.`)) return
    const res = await fetch('/api/transfers', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
    if (res.ok) {
      setLocalTransfers(prev => prev.filter(t => t.id !== id))
      setExpandedId(null)
    }
  }

  async function handleDeleteExpense(id: string, description: string, amount: number) {
    if (!confirm(`Delete expense "${description || 'Expense'}" (PKR ${formatPKR(amount)})? This cannot be undone.`)) return
    const res = await fetch('/api/expenses', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
    if (res.ok) {
      setLocalExpenses(prev => prev.filter(e => e.id !== id))
      setExpandedId(null)
    }
  }

  function handleTransferSaved(data: any) {
    if (editingTransfer) {
      setLocalTransfers(prev => prev.map(t => t.id === data.id ? data : t))
    } else {
      setLocalTransfers(prev => [data, ...prev])
    }
  }

  function handleExpenseSaved(data: any) {
    if (editingExpense) {
      setLocalExpenses(prev => prev.map(e => e.id === data.id ? data : e))
    } else {
      setLocalExpenses(prev => [data, ...prev])
    }
  }

  const shownPart = filterPart === 'all' ? null : parts.find(p => p.id === filterPart)

  const filteredTransfers = (filterPart === 'all'
    ? localTransfers
    : localTransfers.filter(t => t.part_id === filterPart)
  ).map(t => ({ _type: 'transfer' as const, _date: t.date, _created: t.created_at, ...t }))

  const filteredExpenses = localExpenses.flatMap(e => {
    const allocs: AnyAllocation[] = e.expense_allocations ?? []
    const visibleAllocs = filterPart === 'all'
      ? allocs
      : allocs.filter(a => a.part_id === filterPart)
    if (visibleAllocs.length === 0 && filterPart !== 'all') return []
    if (allocs.length <= 1) {
      const allocation = visibleAllocs[0] ?? allocs[0] ?? null
      return [{
        _type: 'expense' as const,
        _date: e.date,
        _created: e.created_at,
        _rowId: `expense-${e.id}`,
        _allocation: allocation,
        _displayAmount: allocation ? Number(allocation.amount) : Number(e.total_amount),
        _isLinkedAllocation: false,
        ...e,
      }]
    }
    return visibleAllocs.map(allocation => ({
      _type: 'expense' as const,
      _date: e.date,
      _created: e.created_at,
      _rowId: `expense-${e.id}-${allocation.part_id}`,
      _allocation: allocation,
      _displayAmount: Number(allocation.amount),
      _isLinkedAllocation: true,
      ...e,
    }))
  })

  const q = search.trim().toLowerCase()
  const combinedItems = transactionFilter === 'expenses' ? filteredExpenses : filteredTransfers

  const recent = combinedItems
    .sort((a, b) => {
      const av = sortByLog ? a._created : a._date
      const bv = sortByLog ? b._created : b._date
      return bv.localeCompare(av)
    })
    .filter(item => {
      if (!q) return true
      const t = item as any
      if (item._type === 'transfer') {
        const ref = fmtRef('TRF', t.ref_number).toLowerCase()
        return ref.includes(q) || (t.from_person ?? '').toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q)
      } else {
        const ref = fmtRef('EXP', t.ref_number).toLowerCase()
        return ref.includes(q) || (t.description ?? '').toLowerCase().includes(q) || (t.paid_to ?? '').toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q)
      }
    })

  return (
    <div className={embedded ? 'pb-8' : 'px-4 pt-5 pb-8'}>

      <div className="flex items-center justify-between mb-4">
        <div className={embedded ? 'min-w-0' : ''}>
          {!embedded && <h1 className="text-xl font-bold text-slate-900">Transactions</h1>}
          <p className="text-xs text-slate-400">{recent.length} entries</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortByLog(s => !s)}
            title={sortByLog ? 'Sorted by log date' : 'Sorted by occurrence date'}
            className={cn('p-2 rounded-xl border transition-colors', sortByLog ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400')}
          >
            <Clock size={14} />
          </button>

          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen(o => !o)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              {shownPart && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: shownPart.color }} />}
              {shownPart ? shownPart.name : 'All Parts'}
              <ChevronDown size={13} className={cn('transition-transform', filterOpen && 'rotate-180')} />
            </button>

            {filterOpen && (
              <div className="absolute top-full right-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[160px] overflow-hidden">
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

          {isSupervisor && (
            <div className="relative" ref={addRef}>
              <button
                onClick={() => setAddOpen(o => !o)}
                className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm"
              >
                <Plus size={14} />
                Add
              </button>
              {addOpen && (
                <div className="absolute top-full right-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[170px] overflow-hidden">
                  <button
                    onClick={() => { setEditingExpense(null); setExpenseSheetOpen(true); setAddOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ReceiptText size={15} className="text-rose-500" />
                    Expense
                  </button>
                  <button
                    onClick={() => { setEditingTransfer(null); setTransferSheetOpen(true); setAddOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowDownToLine size={15} className="text-emerald-600" />
                    Transfer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 bg-slate-100 p-1 rounded-xl">
        {[
          { id: 'expenses' as const, label: 'Expenses', icon: ReceiptText },
          { id: 'transfers' as const, label: 'Transfers', icon: ArrowDownToLine },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTransactionFilter(t.id)}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              transactionFilter === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by ref, name, description…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <X size={14} />
          </button>
        )}
      </div>

      {recent.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">{search ? 'No results' : 'No entries yet'}</p>
        </div>
      )}

      <div className="space-y-2">
        {recent.map(item => {
          const itemId = (item as any)._rowId ?? (item as any).id
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
                        {t.from_person && <span className="text-sm text-slate-700 font-medium">{t.from_person}</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t.ref_number ? <span className="font-mono mr-1.5">{fmtRef('TRF', t.ref_number)}</span> : null}
                        {formatDate(t.date)}
                      </p>
                      {t.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className="text-emerald-600 font-bold text-sm">+{formatPKR(t.amount)}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-2 border-t border-slate-100 bg-slate-50">
                    <div className="space-y-1 text-xs text-slate-500 mb-3">
                      {t.ref_number && <p><span className="text-slate-400">Ref:</span> <span className="font-mono font-semibold text-slate-700">{fmtRef('TRF', t.ref_number)}</span></p>}
                      {part && <p><span className="text-slate-400">Part:</span> {part.name}</p>}
                      {t.from_person && <p><span className="text-slate-400">From:</span> {t.from_person}</p>}
                      <p><span className="text-slate-400">Amount:</span> PKR {formatPKR(t.amount)}</p>
                      <p><span className="text-slate-400">Date:</span> {formatDate(t.date)}</p>
                      {t.notes && <p><span className="text-slate-400">Notes:</span> {t.notes}</p>}
                    </div>
                    {isSupervisor && (
                      <div className="flex gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => { setEditingTransfer(t); setTransferSheetOpen(true) }}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTransfer(t.id, t.from_person, t.amount)}
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
          } else {
            const e = item as any
            const cat = e.categories
            const allocs: AnyAllocation[] = e.expense_allocations ?? []
            const displayAllocs = e._allocation ? [e._allocation] : (filterPart === 'all'
              ? allocs
              : allocs.filter((a: AnyAllocation) => a.part_id === filterPart))
            const displayAmount = Number(e._displayAmount ?? e.total_amount)
            const linked = Boolean(e._isLinkedAllocation)
            const allocationIndex = linked && e._allocation
              ? allocs.findIndex((a: AnyAllocation) => a.part_id === e._allocation.part_id) + 1
              : 0
            const showCategoryChip = cat && cat.name !== (e.description || '')
            const categoryMeta = cat && cat.name !== (e.description || '') ? ` · ${cat.name}` : ''

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
                      <p className="text-sm font-medium text-slate-900 line-clamp-2">{e.description || cat?.name || 'Expense'}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {displayAllocs.map((a: AnyAllocation) => (
                          <span key={a.part_id} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: a.project_parts?.color }}>
                            {a.project_parts?.short_name}
                          </span>
                        ))}
                        {linked && (
                          <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            linked {allocationIndex} of {allocs.length}
                          </span>
                        )}
                        {showCategoryChip && (
                          <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: cat.color }}>
                            {cat.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {e.ref_number ? <span className="font-mono mr-1.5">{fmtRef('EXP', e.ref_number)}</span> : null}
                        {formatDate(e.date)}{showCategoryChip ? '' : categoryMeta}{e.paid_to ? ` · ${e.paid_to}` : ''}
                      </p>
                      {e.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{e.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className="text-rose-500 font-bold text-sm">
                      -{formatPKR(displayAmount)}
                    </span>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-2 border-t border-slate-100 bg-slate-50">
                    <div className="space-y-1 text-xs text-slate-500 mb-3">
                      {e.ref_number && <p><span className="text-slate-400">Ref:</span> <span className="font-mono font-semibold text-slate-700">{fmtRef('EXP', e.ref_number)}</span></p>}
                      {e.description && <p><span className="text-slate-400">Description:</span> {e.description}</p>}
                      {cat && <p><span className="text-slate-400">Category:</span> {cat.name}</p>}
                      {e.paid_to && <p><span className="text-slate-400">Paid to:</span> {e.paid_to}</p>}
                      <p><span className="text-slate-400">Date:</span> {formatDate(e.date)}</p>
                      {allocs.length > 0 && (
                        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2 mt-2">
                          <p className="text-xs font-semibold text-slate-500 mb-1.5">Allocated</p>
                          <div className="space-y-1">
                            {allocs.map((a: AnyAllocation) => (
                              <div key={a.part_id} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 text-slate-600">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.project_parts?.color }} />
                                  {a.project_parts?.short_name ?? 'Part'}
                                </span>
                                <span className="font-semibold text-slate-700">PKR {formatPKR(Number(a.amount))}</span>
                              </div>
                            ))}
                          </div>
                          {allocs.length > 1 && (
                            <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-slate-100">
                              <span className="text-blue-600 font-medium">Linked total</span>
                              <span className="text-blue-600 font-bold">PKR {formatPKR(e.total_amount)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {e.notes && <p><span className="text-slate-400">Notes:</span> {e.notes}</p>}
                    </div>
                    {isSupervisor && (
                      <div className="flex gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => { setEditingExpense(e); setExpenseSheetOpen(true) }}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(e.id, e.description || cat?.name, e.total_amount)}
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
          }
        })}
      </div>

      <TransferSheet
        open={transferSheetOpen}
        onClose={() => { setTransferSheetOpen(false); setEditingTransfer(null) }}
        onSaved={handleTransferSaved}
        editing={editingTransfer as any}
      />

      <ExpenseSheet
        open={expenseSheetOpen}
        onClose={() => { setExpenseSheetOpen(false); setEditingExpense(null) }}
        onSaved={handleExpenseSaved}
        parts={parts}
        categories={categories}
        editing={editingExpense as any}
      />
    </div>
  )
}
