'use client'

import { useState } from 'react'
import { Plus, Pencil, Check, X, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import type { Category } from '@/lib/types'

const COLORS = ['#f59e0b','#3b82f6','#10b981','#8b5cf6','#ef4444','#ec4899','#14b8a6','#f97316','#6366f1','#6b7280']

export default function CategoriesManager({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', color: '#6366f1' })
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', color: '#f59e0b' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()

  async function save(id: string) {
    const res = await fetch('/api/categories', {
      method: 'PUT',
      body: JSON.stringify({ id, ...form }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const updated = await res.json()
      setCategories(prev => prev.map(c => c.id === id ? updated : c))
      setEditingId(null)
    }
  }

  async function add() {
    if (!newForm.name.trim()) return
    const res = await fetch('/api/categories', {
      method: 'POST',
      body: JSON.stringify(newForm),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const created = await res.json()
      setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewForm({ name: '', color: '#f59e0b' })
      setAdding(false)
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setErrors(prev => ({ ...prev, [id]: '' }))
    const res = await fetch('/api/categories', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      setCategories(prev => prev.filter(c => c.id !== id))
    } else {
      const d = await res.json()
      if (res.status === 409) {
        setErrors(prev => ({ ...prev, [id]: `Used by ${d.linkedCount} expense(s) — reassign first` }))
      }
    }
  }

  return (
    <div className="px-4 pt-5 pb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
          <Tag size={18} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Work Categories</h1>
          <p className="text-xs text-slate-400">Tags for classifying works</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {categories.length === 0 && !adding && (
          <div className="text-center py-10 text-slate-400">
            <Tag size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No categories yet. Add your first one.</p>
          </div>
        )}

        {categories.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 shadow-sm">
            {editingId === c.id ? (
              <div className="space-y-3">
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Category name"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(col => (
                    <button
                      key={col}
                      onClick={() => setForm(f => ({ ...f, color: col }))}
                      className={cn('w-7 h-7 rounded-full border-2 transition-transform active:scale-90', form.color === col ? 'border-slate-800 scale-110' : 'border-transparent')}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => save(c.id)} className="flex items-center gap-1.5 text-sm bg-blue-700 text-white px-4 py-2 rounded-xl font-medium">
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
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: c.color + '25' }}>
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: c.color }} />
                    </div>
                    <span className="text-sm font-medium text-slate-900">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setEditingId(c.id); setForm({ name: c.name, color: c.color }) }}
                      className="text-slate-400 active:text-blue-600 p-1"
                    >
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => remove(c.id, c.name)} className="text-slate-400 active:text-red-600 p-1">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                {errors[c.id] && <p className="text-xs text-red-500 mt-2">{errors[c.id]}</p>}
              </div>
            )}
          </div>
        ))}

        {adding && (
          <div className="bg-white rounded-2xl border-2 border-blue-200 px-4 py-3.5 space-y-3">
            <input
              value={newForm.name}
              onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Category name e.g. Labor"
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-wrap gap-2">
              {COLORS.map(col => (
                <button
                  key={col}
                  onClick={() => setNewForm(f => ({ ...f, color: col }))}
                  className={cn('w-7 h-7 rounded-full border-2 transition-transform active:scale-90', newForm.color === col ? 'border-slate-800 scale-110' : 'border-transparent')}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={add} className="flex items-center gap-1.5 text-sm bg-blue-700 text-white px-4 py-2 rounded-xl font-medium">
                <Check size={14} /> Add Category
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
          <Plus size={16} /> Add Category
        </button>
      )}
    </div>
  )
}
