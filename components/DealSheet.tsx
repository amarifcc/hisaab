'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn, amountHint } from '@/lib/utils'
import PersonPicker from '@/components/PersonPicker'
import type { ProjectPart, DealWithPart } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  parts: ProjectPart[]
  editing?: DealWithPart | null
}

const today = () => new Date().toISOString().slice(0, 10)

export default function DealSheet({ open, onClose, onSaved, parts, editing }: Props) {
  const [name, setName] = useState('')
  const [personName, setPersonName] = useState('')
  const [partId, setPartId] = useState('')
  const [agreedAmount, setAgreedAmount] = useState('')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setPersonName(editing.person_name ?? '')
      setPartId(editing.part_id)
      setAgreedAmount(String(editing.agreed_amount))
      setDate(editing.date)
      setNotes(editing.notes ?? '')
    } else {
      setName('')
      setPersonName('')
      setPartId(parts[0]?.id ?? '')
      setAgreedAmount('')
      setDate(today())
      setNotes('')
    }
    setError('')
  }, [editing, open, parts])

  async function handleSave() {
    setError('')
    if (!partId) { setError('Select a floor / part'); return }
    const amount = Number(agreedAmount)
    if (!amount || amount <= 0) { setError('Enter a valid amount'); return }
    if (!personName.trim()) { setError('Select a contractor or supplier'); return }
    if (!name.trim()) { setError('Enter a deal name'); return }

    setLoading(true)
    const method = editing ? 'PUT' : 'POST'
    const body = editing
      ? { id: editing.id, name, person_name: personName, part_id: partId, agreed_amount: amount, date, notes }
      : { name, person_name: personName, part_id: partId, agreed_amount: amount, date, notes }

    const res = await fetch('/api/deals', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to save'); return }
    onSaved()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 safe-bottom max-h-[92vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">{editing ? 'Edit Deal' : 'Add Deal'}</h2>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>

        <div className="space-y-4">
          {/* 1. Floor / Part */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Floor / Part *</label>
            <div className="flex gap-2 flex-wrap">
              {parts.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPartId(p.id)}
                  className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                    partId === p.id ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600'
                  )}
                  style={partId === p.id ? { backgroundColor: p.color, borderColor: p.color } : {}}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Agreed amount */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Agreed Amount (PKR) *</label>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={agreedAmount}
                onChange={e => setAgreedAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 pr-16 rounded-xl border border-slate-200 text-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {amountHint(agreedAmount) && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded pointer-events-none">
                  {amountHint(agreedAmount)}
                </span>
              )}
            </div>
          </div>

          {/* 3. Deal name */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Deal Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Plumbing work, Tiling GF"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 4. Contractor / Supplier */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Contractor / Supplier *</label>
            <PersonPicker value={personName} onChange={setPersonName} placeholder="Select contractor or supplier…" personType={['contractor', 'supplier']} />
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
            <label className="text-xs font-medium text-slate-500 mb-1 block">Deal Date</label>
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
            {loading ? 'Saving…' : editing ? 'Update Deal' : 'Add Deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
