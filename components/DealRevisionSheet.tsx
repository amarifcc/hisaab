'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { dealTotal, sortedDealRevisions } from '@/lib/deals'
import { amountHint, cn, formatDate, formatPKR } from '@/lib/utils'
import type { DealWithPart } from '@/lib/types'

interface Props {
  open: boolean
  deal: DealWithPart | null
  onClose: () => void
  onSaved: (data: DealWithPart) => void
}

const today = () => new Date().toISOString().slice(0, 10)

export default function DealRevisionSheet({ open, deal, onClose, onSaved }: Props) {
  const [scopeDescription, setScopeDescription] = useState('')
  const [amountDelta, setAmountDelta] = useState('')
  const [mode, setMode] = useState<'increase' | 'decrease'>('increase')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function resetForm() {
    setScopeDescription('')
    setAmountDelta('')
    setMode('increase')
    setDate(today())
    setNotes('')
    setError('')
    setLoading(false)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSave() {
    setError('')
    if (!deal) return
    if (!scopeDescription.trim()) { setError('Enter scope description'); return }
    const amount = Number(amountDelta)
    if (!amount || amount <= 0) { setError('Enter a valid amount'); return }

    setLoading(true)
    const signedAmount = mode === 'decrease' ? -amount : amount
    const res = await fetch('/api/deals', {
      method: 'PATCH',
      body: JSON.stringify({ id: deal.id, scope_description: scopeDescription, amount_delta: signedAmount, date, notes }),
      headers: { 'Content-Type': 'application/json' },
    })
    setLoading(false)
    if (!res.ok) { const data = await res.json(); setError(data.error || 'Failed to add scope'); return }
    const data = await res.json()
    onSaved(data)
    handleClose()
  }

  if (!open || !deal) return null
  const part = deal.project_parts
  const revisions = sortedDealRevisions(deal)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 safe-bottom max-h-[92vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Add Scope</h2>
            <p className="text-xs text-slate-400 truncate">{deal.name}</p>
          </div>
          <button onClick={handleClose}><X size={20} className="text-slate-400" /></button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{deal.name}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {part && (
                    <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: part.color }}>
                      {part.short_name}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{part?.name ?? 'Project part'}</span>
                  {deal.person_name && <span className="text-xs text-slate-400">· {deal.person_name}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-slate-400">Current</p>
                <p className="text-sm font-bold text-blue-600">PKR {formatPKR(dealTotal(deal))}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-500">Existing scope</p>
              {revisions.length > 0 ? revisions.map(revision => (
                <div key={revision.id} className="flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-600 truncate">V{revision.revision_number} · {revision.scope_description}</p>
                    <p className="text-slate-400">{formatDate(revision.date)}{revision.notes ? ` · ${revision.notes}` : ''}</p>
                  </div>
                  <span className={cn('font-bold flex-shrink-0', revision.amount_delta < 0 ? 'text-red-500' : 'text-blue-600')}>
                    {revision.amount_delta > 0 ? '+' : '−'}PKR {formatPKR(Math.abs(revision.amount_delta))}
                  </span>
                </div>
              )) : (
                <p className="text-xs text-slate-400">No revisions recorded yet. This change will become the first visible scope revision.</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Scope Description *</label>
            <input
              type="text"
              value={scopeDescription}
              onChange={e => setScopeDescription(e.target.value)}
              placeholder="e.g. Added outdoor drainage"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Change Type</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              {(['increase', 'decrease'] as const).map(value => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={cn('py-2 rounded-lg text-sm font-semibold capitalize', mode === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Amount (PKR) *</label>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={amountDelta}
                onChange={e => setAmountDelta(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 pr-16 rounded-xl border border-slate-200 text-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {amountHint(amountDelta) && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded pointer-events-none">
                  {amountHint(amountDelta)}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Revision Date</label>
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
            {loading ? 'Saving...' : 'Add Scope'}
          </button>
        </div>
      </div>
    </div>
  )
}
