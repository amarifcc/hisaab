'use client'

import { useState } from 'react'
import { Plus, Pencil, Check, X, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type PersonType = 'owner' | 'contractor' | 'employee' | 'supplier'

interface Person { id: string; name: string; person_type: PersonType }

const TYPE_OPTIONS: { value: PersonType; label: string; color: string; bg: string }[] = [
  { value: 'owner',      label: 'Owner',      color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { value: 'contractor', label: 'Contractor',  color: 'text-slate-600',  bg: 'bg-slate-100' },
  { value: 'employee',   label: 'Employee',    color: 'text-amber-600',  bg: 'bg-amber-50'  },
  { value: 'supplier',   label: 'Supplier',    color: 'text-emerald-600',bg: 'bg-emerald-50'},
]

function typeStyle(t: PersonType) {
  return TYPE_OPTIONS.find(o => o.value === t) ?? TYPE_OPTIONS[1]
}

function TypeSelect({ value, onChange }: { value: PersonType; onChange: (v: PersonType) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as PersonType)}
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-[inherit]"
    >
      {TYPE_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export default function PeopleManager({ initialPeople }: { initialPeople: Person[] }) {
  const [people, setPeople] = useState(initialPeople)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<PersonType>('contractor')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<PersonType>('contractor')
  const [error, setError] = useState('')

  async function save(id: string) {
    if (!editName.trim()) return
    const res = await fetch('/api/people', {
      method: 'PUT',
      body: JSON.stringify({ id, name: editName, person_type: editType }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const updated = await res.json()
      setPeople(prev => prev.map(p => p.id === id ? updated : p).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingId(null)
    }
  }

  async function add() {
    if (!newName.trim()) return
    setError('')
    const res = await fetch('/api/people', {
      method: 'POST',
      body: JSON.stringify({ name: newName, person_type: newType }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const created = await res.json()
      setPeople(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewType('contractor')
      setAdding(false)
    } else {
      const d = await res.json()
      setError(d.error?.includes('unique') ? 'That name already exists' : d.error)
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    const res = await fetch('/api/people', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) setPeople(prev => prev.filter(p => p.id !== id))
  }

  const groups = TYPE_OPTIONS.map(o => ({
    ...o,
    people: people.filter(p => p.person_type === o.value),
  })).filter(g => g.people.length > 0 || false)

  function renderPerson(p: Person) {
    const style = typeStyle(p.person_type)
    return (
      <div key={p.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 shadow-sm">
        {editingId === p.id ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && save(p.id)}
                autoFocus
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => save(p.id)} className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center">
                <Check size={14} className="text-white" />
              </button>
              <button onClick={() => setEditingId(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X size={14} className="text-slate-500" />
              </button>
            </div>
            <TypeSelect value={editType} onChange={setEditType} />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-violet-50 flex items-center justify-center">
                <span className="text-sm font-bold text-violet-600">{p.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{p.name}</p>
                <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', style.bg, style.color)}>
                  {style.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setEditingId(p.id); setEditName(p.name); setEditType(p.person_type) }}
                className="text-slate-400 active:text-blue-600 p-1"
              >
                <Pencil size={15} />
              </button>
              <button onClick={() => remove(p.id, p.name)} className="text-slate-400 active:text-red-600 p-1">
                <X size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 pt-5 pb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
          <Users size={18} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">People</h1>
          <p className="text-xs text-slate-400">Owners · Contractors · Employees · Suppliers</p>
        </div>
      </div>

      {people.length === 0 && !adding && (
        <div className="text-center py-10 text-slate-400">
          <Users size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No people yet. Add names you transact with.</p>
        </div>
      )}

      {TYPE_OPTIONS.map(o => {
        const group = people.filter(p => p.person_type === o.value)
        if (group.length === 0) return null
        return (
          <div key={o.value} className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{o.label}s</p>
            <div className="space-y-2">{group.map(renderPerson)}</div>
          </div>
        )
      })}

      {adding && (
        <div className="bg-white rounded-2xl border-2 border-blue-200 px-4 py-3.5 mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={e => { setNewName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="Enter name"
              autoFocus
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={add} className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center">
              <Check size={14} className="text-white" />
            </button>
            <button onClick={() => { setAdding(false); setError('') }} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <X size={14} className="text-slate-500" />
            </button>
          </div>
          <TypeSelect value={newType} onChange={setNewType} />
          {error && <p className="text-xs text-red-500 ml-1">{error}</p>}
        </div>
      )}

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm text-slate-500 font-medium active:border-blue-400 active:text-blue-600 transition-colors"
        >
          <Plus size={16} /> Add Person
        </button>
      )}
    </div>
  )
}
