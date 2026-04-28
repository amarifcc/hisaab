'use client'

import { useState } from 'react'
import { Plus, Pencil, Check, X, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import type { ProjectPart } from '@/lib/types'

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#ec4899','#14b8a6','#f97316','#6366f1','#6b7280']

export default function PartsManager({ initialParts }: { initialParts: ProjectPart[] }) {
  const [parts, setParts] = useState(initialParts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', short_name: '', color: '#3b82f6' })
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', short_name: '', color: '#3b82f6' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()

  async function save(id: string) {
    const res = await fetch('/api/parts', {
      method: 'PUT',
      body: JSON.stringify({ id, ...form }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const updated = await res.json()
      setParts(prev => prev.map(p => p.id === id ? updated : p))
      setEditingId(null)
      router.refresh()
    }
  }

  async function add() {
    if (!newForm.name.trim() || !newForm.short_name.trim()) return
    const res = await fetch('/api/parts', {
      method: 'POST',
      body: JSON.stringify({ ...newForm, sort_order: parts.length }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const created = await res.json()
      setParts(prev => [...prev, created])
      setNewForm({ name: '', short_name: '', color: '#3b82f6' })
      setAdding(false)
      router.refresh()
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setErrors(prev => ({ ...prev, [id]: '' }))
    const res = await fetch('/api/parts', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      setParts(prev => prev.filter(p => p.id !== id))
      router.refresh()
    } else {
      const d = await res.json()
      if (res.status === 409) {
        setErrors(prev => ({ ...prev, [id]: `${d.linkedCount} linked record(s) — remove them first` }))
      }
    }
  }

  return (
    <div className="px-4 pt-5 pb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <Layers size={18} className="text-blue-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Project Parts</h1>
          <p className="text-xs text-slate-400">Floors or sections of the project</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {parts.length === 0 && !adding && (
          <div className="text-center py-10 text-slate-400">
            <Layers size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No parts yet. Add your first one.</p>
          </div>
        )}

        {parts.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 shadow-sm">
            {editingId === p.id ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name e.g. Ground Floor"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    value={form.short_name}
                    onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
                    placeholder="GF"
                    className="w-16 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={cn('w-7 h-7 rounded-full border-2 transition-transform active:scale-90', form.color === c ? 'border-slate-800 scale-110' : 'border-transparent')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => save(p.id)} className="flex items-center gap-1.5 text-sm bg-blue-700 text-white px-4 py-2 rounded-xl font-medium">
                    <Check size={14} /> Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-sm text-slate-500 px-4 py-2 rounded-xl border border-slate-200">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: p.color + '20' }}>
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.short_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setEditingId(p.id); setForm({ name: p.name, short_name: p.short_name, color: p.color }) }}
                      className="text-slate-400 active:text-blue-600 p-1"
                    >
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => remove(p.id, p.name)} className="text-slate-400 active:text-red-600 p-1">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                {errors[p.id] && (
                  <p className="text-xs text-red-500 mt-2 ml-13">{errors[p.id]}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add new form */}
        {adding && (
          <div className="bg-white rounded-2xl border-2 border-blue-200 px-4 py-3.5 space-y-3">
            <div className="flex gap-2">
              <input
                value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name e.g. Ground Floor"
                autoFocus
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                value={newForm.short_name}
                onChange={e => setNewForm(f => ({ ...f, short_name: e.target.value }))}
                placeholder="GF"
                className="w-16 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewForm(f => ({ ...f, color: c }))}
                  className={cn('w-7 h-7 rounded-full border-2 transition-transform active:scale-90', newForm.color === c ? 'border-slate-800 scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={add} className="flex items-center gap-1.5 text-sm bg-blue-700 text-white px-4 py-2 rounded-xl font-medium">
                <Check size={14} /> Add Part
              </button>
              <button onClick={() => setAdding(false)} className="text-sm text-slate-500 px-4 py-2 rounded-xl border border-slate-200">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm text-slate-500 font-medium active:border-blue-400 active:text-blue-600 transition-colors"
        >
          <Plus size={16} /> Add Part
        </button>
      )}
    </div>
  )
}
