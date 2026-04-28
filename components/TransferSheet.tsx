'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn, amountHint } from '@/lib/utils'
import PersonPicker from '@/components/PersonPicker'
import type { ProjectPart, Transfer } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  parts: ProjectPart[]
  editing?: Transfer | null
}

const today = () => new Date().toISOString().slice(0, 10)

export default function TransferSheet({ open, onClose, onSaved, parts, editing }: Props) {
  const [partId, setPartId] = useState('')
  const [fromPerson, setFromPerson] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing) {
      setPartId(editing.part_id)
      setFromPerson(editing.from_person ?? '')
      setAmount(String(editing.amount))
      setDate(editing.date)
      setNotes(editing.notes ?? '')
    } else {
      setPartId(parts[0]?.id ?? '')
      setFromPerson('')
      setAmount('')
      setDate(today())
      setNotes('')
    }
    setError('')
  }, [editing, open, parts])

  async function handleSave() {
    if (!partId || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (!fromPerson.trim()) {
      setError('Enter who this transfer is from')
      return
    }
    setLoading(true)
    setError('')
    const method = editing ? 'PUT' : 'POST'
    const body = editing
      ? { id: editing.id, part_id: partId, from_person: fromPerson, amount: Number(amount), date, notes }
      : { part_id: partId, from_person: fromPerson, amount: Number(amount), date, notes }

    const res = await fetch('/api/transfers', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    setLoading(false)
    if (!res.ok) { setError('Failed to save'); return }
    onSaved()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 safe-bottom">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{editing ? 'Edit Transfer' : 'Add Transfer'}</h2>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>

        {/* Part selector */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Floor / Part</label>
          <div className="flex gap-2 flex-wrap">
            {parts.map(p => (
              <button
                key={p.id}
                onClick={() => setPartId(p.id)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                  partId === p.id ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600'
                )}
                style={partId === p.id ? { backgroundColor: p.color, borderColor: p.color } : {}}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Amount (PKR)</label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 pr-16 rounded-xl border border-slate-200 text-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {amountHint(amount) && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded pointer-events-none">
                {amountHint(amount)}
              </span>
            )}
          </div>
        </div>

        {/* From person (required) */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">From *</label>
          <PersonPicker value={fromPerson} onChange={setFromPerson} placeholder="Select owner or type…" personType="owner" />
        </div>

        {/* Notes */}
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

        {/* Date */}
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
          {loading ? 'Saving…' : editing ? 'Update Transfer' : 'Add Transfer'}
        </button>
      </div>
    </div>
  )
}
