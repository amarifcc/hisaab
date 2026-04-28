'use client'

import { useState } from 'react'
import { Plus, Pencil, Check, X, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, ProjectPart, Category } from '@/lib/types'
import { cn } from '@/lib/utils'

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#ec4899','#14b8a6','#f97316','#6366f1','#6b7280']

interface Props {
  profile: Profile | null
  parts: ProjectPart[]
  categories: Category[]
  isSupervisor: boolean
}

export default function SettingsView({ profile, parts: initialParts, categories: initialCats, isSupervisor }: Props) {
  const [parts, setParts] = useState(initialParts)
  const [categories, setCategories] = useState(initialCats)
  const router = useRouter()

  // Part editing state
  const [editingPart, setEditingPart] = useState<string | null>(null)
  const [partForm, setPartForm] = useState({ name: '', short_name: '', color: '#6366f1' })
  const [newPartOpen, setNewPartOpen] = useState(false)
  const [newPart, setNewPart] = useState({ name: '', short_name: '', color: '#3b82f6' })
  const [partError, setPartError] = useState<Record<string, string>>({})

  // Category editing state
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [catForm, setCatForm] = useState({ name: '', color: '#6366f1' })
  const [newCatOpen, setNewCatOpen] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', color: '#6366f1' })

  const [catError, setCatError] = useState<Record<string, string>>({})

  async function savePart(id: string) {
    const res = await fetch('/api/parts', {
      method: 'PUT',
      body: JSON.stringify({ id, ...partForm }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const updated = await res.json()
      setParts(prev => prev.map(p => p.id === id ? updated : p))
      setEditingPart(null)
      router.refresh()
    }
  }

  async function addPart() {
    if (!newPart.name || !newPart.short_name) return
    const res = await fetch('/api/parts', {
      method: 'POST',
      body: JSON.stringify({ ...newPart, sort_order: parts.length }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const created = await res.json()
      setParts(prev => [...prev, created])
      setNewPart({ name: '', short_name: '', color: '#3b82f6' })
      setNewPartOpen(false)
      router.refresh()
    }
  }

  async function deletePart(id: string) {
    setPartError(prev => ({ ...prev, [id]: '' }))
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
        setPartError(prev => ({ ...prev, [id]: `Has ${d.linkedCount} linked record(s) — remove them first` }))
      }
    }
  }

  async function saveCat(id: string) {
    const res = await fetch('/api/categories', {
      method: 'PUT',
      body: JSON.stringify({ id, ...catForm }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const updated = await res.json()
      setCategories(prev => prev.map(c => c.id === id ? updated : c))
      setEditingCat(null)
    }
  }

  async function addCat() {
    if (!newCat.name) return
    const res = await fetch('/api/categories', {
      method: 'POST',
      body: JSON.stringify(newCat),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const created = await res.json()
      setCategories(prev => [...prev, created])
      setNewCat({ name: '', color: '#6366f1' })
      setNewCatOpen(false)
    }
  }

  async function deleteCat(id: string) {
    setCatError(prev => ({ ...prev, [id]: '' }))
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
        setCatError(prev => ({ ...prev, [id]: `Used by ${d.linkedCount} expense(s) — reassign first` }))
      }
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="px-4 pt-5 pb-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Settings</h1>

      {/* Account */}
      <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <p className="text-xs font-semibold text-slate-400 px-4 pt-3 pb-2 uppercase tracking-wide">Account</p>
        <div className="px-4 py-3 border-t border-slate-50 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">{profile?.name}</p>
            <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </section>

      {/* Project parts */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-700">Project Parts</p>
          {isSupervisor && (
            <button onClick={() => setNewPartOpen(true)} className="flex items-center gap-1 text-xs text-blue-700 font-medium">
              <Plus size={14} /> Add Part
            </button>
          )}
        </div>
        <div className="space-y-2">
          {parts.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
              {editingPart === p.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={partForm.name} onChange={e => setPartForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Full name" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value={partForm.short_name} onChange={e => setPartForm(f => ({ ...f, short_name: e.target.value }))}
                      placeholder="GF" className="w-16 px-3 py-2 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setPartForm(f => ({ ...f, color: c }))}
                        className={cn('w-6 h-6 rounded-full border-2', partForm.color === c ? 'border-slate-900' : 'border-transparent')}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => savePart(p.id)} className="flex items-center gap-1 text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg"><Check size={12} /> Save</button>
                    <button onClick={() => setEditingPart(null)} className="text-xs text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-medium text-slate-900">{p.name}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{p.short_name}</span>
                    </div>
                    {isSupervisor && (
                      <div className="flex gap-3 items-center">
                        <button onClick={() => { setEditingPart(p.id); setPartForm({ name: p.name, short_name: p.short_name, color: p.color }) }}
                          className="text-slate-400"><Pencil size={14} /></button>
                        <button onClick={() => deletePart(p.id)} className="text-slate-400 active:text-red-600"><X size={14} /></button>
                      </div>
                    )}
                  </div>
                  {partError[p.id] && <p className="text-xs text-red-500 mt-1">{partError[p.id]}</p>}
                </div>
              )}
            </div>
          ))}

          {newPartOpen && (
            <div className="bg-white rounded-xl border border-blue-200 px-4 py-3 space-y-2">
              <div className="flex gap-2">
                <input value={newPart.name} onChange={e => setNewPart(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name e.g. Ground Floor" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={newPart.short_name} onChange={e => setNewPart(f => ({ ...f, short_name: e.target.value }))}
                  placeholder="GF" className="w-16 px-3 py-2 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setNewPart(f => ({ ...f, color: c }))}
                    className={cn('w-6 h-6 rounded-full border-2', newPart.color === c ? 'border-slate-900' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={addPart} className="flex items-center gap-1 text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg"><Check size={12} /> Add</button>
                <button onClick={() => setNewPartOpen(false)} className="text-xs text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-700">Categories</p>
          {isSupervisor && (
            <button onClick={() => setNewCatOpen(true)} className="flex items-center gap-1 text-xs text-blue-700 font-medium">
              <Plus size={14} /> Add Category
            </button>
          )}
        </div>
        <div className="space-y-2">
          {categories.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
              {editingCat === c.id ? (
                <div className="space-y-2">
                  <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Category name" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map(col => (
                      <button key={col} onClick={() => setCatForm(f => ({ ...f, color: col }))}
                        className={cn('w-6 h-6 rounded-full border-2', catForm.color === col ? 'border-slate-900' : 'border-transparent')}
                        style={{ backgroundColor: col }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveCat(c.id)} className="flex items-center gap-1 text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg"><Check size={12} /> Save</button>
                    <button onClick={() => setEditingCat(null)} className="text-xs text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-sm text-slate-900">{c.name}</span>
                  </div>
                  {isSupervisor && (
                    <div className="flex gap-3 items-center">
                      {catError[c.id] && <span className="text-xs text-red-500 text-right">{catError[c.id]}</span>}
                      <button onClick={() => { setEditingCat(c.id); setCatForm({ name: c.name, color: c.color }) }} className="text-slate-400"><Pencil size={14} /></button>
                      <button onClick={() => deleteCat(c.id)} className="text-slate-400 active:text-red-600"><X size={14} /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {newCatOpen && (
            <div className="bg-white rounded-xl border border-blue-200 px-4 py-3 space-y-2">
              <input value={newCat.name} onChange={e => setNewCat(f => ({ ...f, name: e.target.value }))}
                placeholder="Category name" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map(col => (
                  <button key={col} onClick={() => setNewCat(f => ({ ...f, color: col }))}
                    className={cn('w-6 h-6 rounded-full border-2', newCat.color === col ? 'border-slate-900' : 'border-transparent')}
                    style={{ backgroundColor: col }} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={addCat} className="flex items-center gap-1 text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg"><Check size={12} /> Add</button>
                <button onClick={() => setNewCatOpen(false)} className="text-xs text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Logs link */}
      <a href="/logs" className="block text-center text-xs text-slate-400 underline py-2">View Activity Logs</a>
    </div>
  )
}
