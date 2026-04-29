'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, ArrowDownLeft, ChevronDown } from 'lucide-react'
import { formatPKR, formatDate, fmtRef, cn } from '@/lib/utils'
import TransferSheet from '@/components/TransferSheet'
import type { ProjectPart, Transfer } from '@/lib/types'

type TransferWithPart = Transfer & { project_parts: ProjectPart }

interface Props {
  initialTransfers: TransferWithPart[]
  parts: ProjectPart[]
  isSupervisor: boolean
}

const PART_FILTER_KEY = 'hisab_transfers_filter_part'

export default function TransfersList({ initialTransfers, parts, isSupervisor }: Props) {
  const [transfers, setTransfers] = useState(initialTransfers)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Transfer | null>(null)
  const [filterPart, setFilterPart] = useState<string>('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
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
  const filtered = filterPart === 'all' ? transfers : transfers.filter(t => t.part_id === filterPart)
  const totalFiltered = filtered.reduce((s, t) => s + t.amount, 0)

  function handleSaved(data: any) {
    if (editing) {
      setTransfers(prev => prev.map(t => t.id === data.id ? data : t))
    } else {
      setTransfers(prev => [data, ...prev])
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this transfer?')) return
    const res = await fetch('/api/transfers', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
    if (res.ok) setTransfers(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="px-4 pt-5 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Transfers</h1>
          <p className="text-xs text-slate-400">PKR {formatPKR(totalFiltered)}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Part dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              {selectedPart && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedPart.color }} />}
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
              className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium"
            >
              <Plus size={16} /> Add
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-10">No transfers</p>
        )}
        {filtered.map(t => {
          const part = (t as TransferWithPart).project_parts
          return (
            <div key={t.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: part?.color + '20' }}>
                    <ArrowDownLeft size={18} style={{ color: part?.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: part?.color }}>
                        {part?.short_name}
                      </span>
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Transfer</span>
                      {t.from_person && <span className="text-sm text-slate-700 font-medium">{t.from_person}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t.ref_number ? <span className="font-mono mr-1.5">{fmtRef('TRF', t.ref_number)}</span> : null}
                      {formatDate(t.date)}
                    </p>
                    {t.notes && <p className="text-xs text-slate-500 mt-0.5">{t.notes}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-emerald-600 font-bold">PKR {formatPKR(t.amount)}</span>
                  {isSupervisor && (
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(t); setSheetOpen(true) }} className="text-slate-400 active:text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(t.id)} className="text-slate-400 active:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <TransferSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={handleSaved}
        editing={editing}
      />
    </div>
  )
}
