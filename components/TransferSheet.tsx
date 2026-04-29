'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { amountHint } from '@/lib/utils'
import PersonPicker from '@/components/PersonPicker'
import type { Transfer } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (data: any) => void
  editing?: Transfer | null
}

const today = () => new Date().toISOString().slice(0, 10)

export default function TransferSheet({ open, onClose, onSaved, editing }: Props) {
  const [fromPerson, setFromPerson] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing) {
      setFromPerson(editing.from_person ?? '')
      setAmount(String(editing.amount))
      setDate(editing.date)
      setNotes(editing.notes ?? '')
    } else {
      setFromPerson('')
      setAmount('')
      setDate(today())
      setNotes('')
    }
    setError('')
  }, [editing, open])

  async function handleSave() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (!fromPerson.trim()) {
      setError('Select who this transfer is from')
      return
    }
    setLoading(true)
    setError('')
    const method = editing ? 'PUT' : 'POST'
    const body = editing
      ? { id: editing.id, from_person: fromPerson, amount: Number(amount), date, notes }
      : { from_person: fromPerson, amount: Number(amount), date, notes }

    const res = await fetch('/api/transfers', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to save'); return }
    const data = await res.json()
    onSaved(data)
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

        {/* From person (required) */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">From *</label>
          <PersonPicker value={fromPerson} onChange={setFromPerson} placeholder="Select owner…" personType="owner" />
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Amount (PKR) *</label>
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
