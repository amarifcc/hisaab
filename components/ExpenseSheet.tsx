'use client'

import { useState, useEffect } from 'react'
import { X, SplitSquareHorizontal } from 'lucide-react'
import { cn, formatPKR, amountHint } from '@/lib/utils'
import PersonPicker from '@/components/PersonPicker'
import type { ProjectPart, Category, Expense, ExpenseAllocation } from '@/lib/types'

interface Allocation { part_id: string; amount: string }

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (data: any) => void
  parts: ProjectPart[]
  categories: Category[]
  editing?: (Expense & { expense_allocations: (ExpenseAllocation & { project_parts: ProjectPart })[] }) | null
}

const today = () => new Date().toISOString().slice(0, 10)

export default function ExpenseSheet({ open, onClose, onSaved, parts, categories, editing }: Props) {
  const [totalAmount, setTotalAmount] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [paidTo, setPaidTo] = useState('')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [isSplit, setIsSplit] = useState(false)
  const [singlePartId, setSinglePartId] = useState('')
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fe, setFe] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    if (editing) {
      setTotalAmount(String(editing.total_amount))
      setCategoryId(editing.category_id ?? '')
      setPaidTo(editing.paid_to ?? '')
      setDate(editing.date)
      setNotes(editing.notes ?? '')
      const allocs = editing.expense_allocations ?? []
      if (allocs.length === 1) {
        setIsSplit(false)
        setSinglePartId(allocs[0].part_id)
        setAllocations([{ part_id: allocs[0].part_id, amount: String(allocs[0].amount) }])
      } else {
        setIsSplit(true)
        setSinglePartId('')
        setAllocations(allocs.map(a => ({ part_id: a.part_id, amount: String(a.amount) })))
      }
    } else {
      setTotalAmount('')
      setCategoryId('')
      setPaidTo('')
      setDate(today())
      setNotes('')
      setIsSplit(false)
      setSinglePartId('')
      setAllocations(parts.map(p => ({ part_id: p.id, amount: '' })))
    }
    setError('')
    setFe({})
  }, [editing, open, parts])

  function handleSplitAmount(partId: string, value: string) {
    const updated = allocations.map(a => a.part_id === partId ? { ...a, amount: value } : a)
    const total = Number(totalAmount)
    if (!isNaN(total) && total > 0 && updated.length === 2) {
      const filledIdx = updated.findIndex(a => a.part_id === partId)
      const otherIdx = filledIdx === 0 ? 1 : 0
      const filled = Number(value)
      if (!isNaN(filled) && filled <= total) {
        updated[otherIdx] = { ...updated[otherIdx], amount: String(total - filled) }
      }
    }
    setAllocations(updated)
  }

  function buildAllocations(): { part_id: string; amount: number }[] | null {
    const total = Number(totalAmount)
    if (isSplit) {
      const result = allocations.filter(a => Number(a.amount) > 0).map(a => ({ part_id: a.part_id, amount: Number(a.amount) }))
      const sum = result.reduce((s, a) => s + a.amount, 0)
      if (Math.abs(sum - total) > 0.01) return null
      return result
    } else {
      if (!singlePartId) return null
      return [{ part_id: singlePartId, amount: total }]
    }
  }

  async function handleSave() {
    const total = Number(totalAmount)
    const allocs = buildAllocations()
    const errors: Record<string, boolean> = {}

    if (!total || total <= 0) errors.amount = true
    if (!isSplit && !singlePartId) errors.part = true
    if (!categoryId) errors.category = true
    if (!paidTo.trim()) errors.paidTo = true
    if (!allocs) errors.split = true

    if (Object.keys(errors).length > 0) {
      setFe(errors)
      setError('Please fill in all required fields')
      return
    }

    setFe({})
    setError('')
    const finalDescription = categories.find(c => c.id === categoryId)?.name || 'Expense'

    setLoading(true)
    const method = editing ? 'PUT' : 'POST'
    const body = editing
      ? { id: editing.id, description: finalDescription, total_amount: total, paid_to: paidTo, category_id: categoryId, date, notes, allocations: allocs }
      : { description: finalDescription, total_amount: total, paid_to: paidTo, category_id: categoryId, date, notes, allocations: allocs }

    const res = await fetch('/api/expenses', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to save'); return }
    const data = await res.json()
    onSaved(data)
    onClose()
  }

  if (!open) return null

  const total = Number(totalAmount)
  const allocSum = allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const remainder = total - allocSum

  const selectedCatName = categories.find(c => c.id === categoryId)?.name ?? ''
  const isSalary = /salary/i.test(selectedCatName)
  const paidToType: 'employee' | 'contractor' = isSalary ? 'employee' : 'contractor'

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 safe-bottom max-h-[92vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>

        <div className="space-y-4">
          {/* 1. Floor allocation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-500">Floor / Part *</label>
              <button
                onClick={() => setIsSplit(s => !s)}
                className={cn('flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors',
                  isSplit ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200'
                )}
              >
                <SplitSquareHorizontal size={12} />
                Split
              </button>
            </div>

            {!isSplit ? (
              <div className={cn('flex gap-2 flex-wrap p-1 rounded-xl', fe.part && 'outline outline-2 outline-red-400')}>
                {parts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSinglePartId(p.id); setFe(f => ({ ...f, part: false })) }}
                    className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                      singlePartId === p.id ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600'
                    )}
                    style={singlePartId === p.id ? { backgroundColor: p.color, borderColor: p.color } : {}}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {parts.map(p => {
                  const allocVal = allocations.find(a => a.part_id === p.id)?.amount ?? ''
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-24">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-sm text-slate-700 font-medium">{p.short_name}</span>
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={allocVal}
                          onChange={e => { handleSplitAmount(p.id, e.target.value); setFe(f => ({ ...f, split: false })) }}
                          placeholder="0"
                          className={cn('w-full px-3 py-2.5 pr-14 rounded-xl border text-slate-900 font-medium focus:outline-none focus:ring-2',
                            fe.split ? 'border-red-400 ring-1 ring-red-400 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'
                          )}
                        />
                        {amountHint(allocVal) && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded pointer-events-none">
                            {amountHint(allocVal)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {total > 0 && (
                  <p className={cn('text-xs font-medium', Math.abs(remainder) < 0.01 ? 'text-emerald-600' : 'text-amber-600')}>
                    {Math.abs(remainder) < 0.01
                      ? '✓ Balanced'
                      : remainder > 0
                        ? `PKR ${formatPKR(remainder)} remaining`
                        : `PKR ${formatPKR(-remainder)} over`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 2. Amount */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Amount (PKR) *</label>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={totalAmount}
                onChange={e => { setTotalAmount(e.target.value); setFe(f => ({ ...f, amount: false })) }}
                placeholder="0"
                className={cn('w-full px-4 py-3 pr-16 rounded-xl border text-xl font-semibold text-slate-900 focus:outline-none focus:ring-2',
                  fe.amount ? 'border-red-400 ring-1 ring-red-400 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'
                )}
              />
              {amountHint(totalAmount) && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded pointer-events-none">
                  {amountHint(totalAmount)}
                </span>
              )}
            </div>
          </div>

          {/* 3. Category (required) */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Category *</label>
            <div className="relative">
              {categoryId && (
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none z-10"
                  style={{ backgroundColor: categories.find(c => c.id === categoryId)?.color }}
                />
              )}
              <select
                value={categoryId}
                onChange={e => {
                  const newCatName = categories.find(c => c.id === e.target.value)?.name ?? ''
                  const newIsSalary = /salary/i.test(newCatName)
                  if (newIsSalary !== isSalary) setPaidTo('')
                  setCategoryId(e.target.value)
                  setFe(f => ({ ...f, category: false }))
                }}
                className={cn(
                  'w-full py-3 pr-4 rounded-xl border text-slate-900 text-base font-normal bg-white focus:outline-none focus:ring-2 appearance-none font-[inherit]',
                  fe.category ? 'border-red-400 ring-1 ring-red-400 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500',
                  categoryId ? 'pl-8' : 'pl-4'
                )}
              >
                <option value="">Select category…</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Paid to */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              Paid To * {isSalary && <span className="text-amber-500 font-normal">(Employee)</span>}
            </label>
            <PersonPicker
              value={paidTo}
              onChange={v => { setPaidTo(v); setFe(f => ({ ...f, paidTo: false })) }}
              placeholder={isSalary ? 'Select employee…' : 'Select contractor or type…'}
              personType={paidToType}
              hasError={fe.paidTo}
            />
          </div>

          {/* 5. Notes */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes…"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 6. Date */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3.5 bg-blue-700 text-white font-semibold rounded-xl text-base disabled:opacity-50"
          >
            {loading ? 'Saving…' : editing ? 'Update Expense' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
