'use client'

import { useState } from 'react'
import { Plus, Pencil, Check, X, Tag, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'

const COLORS = ['#f59e0b','#3b82f6','#10b981','#8b5cf6','#ef4444','#ec4899','#14b8a6','#f97316','#6366f1','#6b7280']

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map(col => (
        <button key={col} type="button" onClick={() => onChange(col)}
          className={cn('w-7 h-7 rounded-full border-2 transition-transform active:scale-90',
            value === col ? 'border-slate-800 scale-110' : 'border-transparent')}
          style={{ backgroundColor: col }}
        />
      ))}
    </div>
  )
}

interface EditForm { name: string; color: string; parent_id: string | null; is_group: boolean }
interface AddForm  { name: string; color: string }

function EditInline({ c, editForm, setEditForm, groups, groupIds, onSave, onCancel }: {
  c: Category
  editForm: EditForm
  setEditForm: (f: EditForm) => void
  groups: Category[]
  groupIds: Set<string>
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-3 py-1">
      <input
        autoFocus
        value={editForm.name}
        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
        onKeyDown={e => e.key === 'Enter' && onSave()}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {c.is_group && <ColorPicker value={editForm.color} onChange={col => setEditForm({ ...editForm, color: col })} />}
      {!c.is_group && <p className="text-xs text-slate-400">Color inherited from group</p>}
      {!c.is_group && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">Parent group</label>
          <select
            value={editForm.parent_id ?? ''}
            onChange={e => setEditForm({ ...editForm, parent_id: e.target.value || null })}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Ungrouped</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onSave} className="flex items-center gap-1.5 text-sm bg-blue-700 text-white px-4 py-2 rounded-xl font-medium">
          <Check size={14} /> Save
        </button>
        <button onClick={onCancel} className="text-sm text-slate-500 px-4 py-2 rounded-xl border border-slate-200">
          Cancel
        </button>
      </div>
    </div>
  )
}

function CategoryRow({ c, resolvedColor, editingId, editForm, setEditForm, groups, groupIds, onStartEdit, onSave, onCancel, onRemove, error }: {
  c: Category
  resolvedColor?: string
  editingId: string | null
  editForm: EditForm
  setEditForm: (f: EditForm) => void
  groups: Category[]
  groupIds: Set<string>
  onStartEdit: (c: Category) => void
  onSave: () => void
  onCancel: () => void
  onRemove: (id: string, name: string) => void
  error?: string
}) {
  const color = resolvedColor ?? c.color
  return (
    <div className="bg-white rounded-xl border border-slate-100 px-3 py-3 shadow-sm">
      {editingId === c.id ? (
        <EditInline c={c} editForm={editForm} setEditForm={setEditForm} groups={groups} groupIds={groupIds} onSave={onSave} onCancel={onCancel} />
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '25' }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              </div>
              <span className="text-sm font-medium text-slate-900">{c.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onStartEdit(c)} className="text-slate-400 active:text-blue-600 p-1"><Pencil size={14} /></button>
              <button onClick={() => onRemove(c.id, c.name)} className="text-slate-400 active:text-red-600 p-1"><X size={14} /></button>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        </div>
      )}
    </div>
  )
}

function AddSubForm({ parentId, parentColor, addForm, setAddForm, onAdd, onCancel }: {
  parentId: string | null
  parentColor?: string
  addForm: AddForm
  setAddForm: (f: AddForm) => void
  onAdd: () => void
  onCancel: () => void
}) {
  const isGroup = parentId === null
  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 px-3 py-3 space-y-3">
      <div className="flex items-center gap-2">
        {!isGroup && parentColor && (
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parentColor }} />
        )}
        <input
          autoFocus
          value={addForm.name}
          onChange={e => setAddForm({ ...addForm, name: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          placeholder={isGroup ? 'Group name…' : 'Sub-category name…'}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {isGroup && <ColorPicker value={addForm.color} onChange={col => setAddForm({ ...addForm, color: col })} />}
      {!isGroup && <p className="text-xs text-slate-400">Color inherited from group</p>}
      <div className="flex gap-2">
        <button onClick={onAdd} className="flex items-center gap-1.5 text-sm bg-blue-700 text-white px-4 py-2 rounded-xl font-medium">
          <Check size={14} /> Add
        </button>
        <button onClick={onCancel} className="text-sm text-slate-500 px-4 py-2 rounded-xl border border-slate-200">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function CategoriesManager({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ name: '', color: '#6366f1', parent_id: null, is_group: false })
  const [addingUnder, setAddingUnder] = useState<string | 'new-group' | null>(null)
  const [addForm, setAddForm] = useState<AddForm>({ name: '', color: '#f59e0b' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = categories.filter(c => c.is_group)
  const groupIds = new Set(groups.map(g => g.id))
  // Orphaned: has a parent_id but that parent is no longer a group
  const orphaned = categories.filter(c => c.parent_id !== null && !groupIds.has(c.parent_id))
  const ungrouped = [
    ...categories.filter(c => !c.is_group && c.parent_id === null),
    ...orphaned,
  ]

  function childrenOf(parentId: string) {
    return categories.filter(c => c.parent_id === parentId)
  }

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function startEdit(c: Category) {
    setEditingId(c.id)
    setEditForm({ name: c.name, color: c.color, parent_id: c.parent_id, is_group: c.is_group })
  }

  async function saveEdit() {
    if (!editingId) return
    const res = await fetch('/api/categories', {
      method: 'PUT',
      body: JSON.stringify({ id: editingId, ...editForm }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const updated = await res.json()
      setCategories(prev => prev.map(c => c.id === editingId ? updated : c))
      setEditingId(null)
    }
  }

  async function addCategory() {
    if (!addForm.name.trim()) return
    const parent_id = addingUnder === 'new-group' ? null : addingUnder
    const is_group = addingUnder === 'new-group'
    const color = is_group
      ? addForm.color
      : (categories.find(c => c.id === parent_id)?.color ?? addForm.color)
    const res = await fetch('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ ...addForm, color, parent_id, is_group }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const created = await res.json()
      setCategories(prev => [...prev, created])
      setAddForm({ name: '', color: '#f59e0b' })
      setAddingUnder(null)
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
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
      setErrors(prev => ({ ...prev, [id]: d.error ?? 'Cannot delete' }))
    }
  }

  function cancelAdd() {
    setAddingUnder(null)
    setAddForm({ name: '', color: '#f59e0b' })
  }

  const sharedRowProps = { editingId, editForm, setEditForm, groups, groupIds, onStartEdit: startEdit, onSave: saveEdit, onCancel: () => setEditingId(null), onRemove: remove }

  return (
    <div className="px-4 pt-5 pb-8">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Tag size={18} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">Categories</h1>
            <p className="text-xs text-slate-400 leading-snug">Groups and sub-categories</p>
          </div>
        </div>
        {addingUnder !== 'new-group' && (
          <button
            onClick={() => { setAddingUnder('new-group'); setAddForm({ name: '', color: '#6366f1' }) }}
            className="flex items-center gap-1 bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium flex-shrink-0"
            aria-label="Add group"
          >
            <Plus size={15} />
            <span className="hidden min-[380px]:inline">Add Group</span>
            <span className="min-[380px]:hidden">Group</span>
          </button>
        )}
      </div>

      {addingUnder === 'new-group' && (
        <div className="mb-3">
          <AddSubForm parentId={null} addForm={addForm} setAddForm={setAddForm} onAdd={addCategory} onCancel={cancelAdd} />
        </div>
      )}

      <div className="space-y-3">
        {groups.map(group => {
          const children = childrenOf(group.id)
          const isCollapsed = collapsed.has(group.id)
          return (
            <div key={group.id} className="space-y-1.5">
              <div className="bg-slate-50 rounded-xl border border-slate-200 px-3 py-3">
                {editingId === group.id ? (
                  <EditInline c={group} editForm={editForm} setEditForm={setEditForm} groups={groups} groupIds={groupIds} onSave={saveEdit} onCancel={() => setEditingId(null)} />
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <button onClick={() => toggleCollapse(group.id)} className="flex items-center gap-2 flex-1 text-left">
                        {isCollapsed ? <ChevronRight size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                        <FolderOpen size={15} className="text-slate-500" />
                        <span className="text-sm font-semibold text-slate-800">{group.name}</span>
                        <span className="text-xs text-slate-400">{children.length} sub</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(group)} className="text-slate-400 active:text-blue-600 p-1"><Pencil size={14} /></button>
                        <button onClick={() => remove(group.id, group.name)} className="text-slate-400 active:text-red-600 p-1"><X size={14} /></button>
                      </div>
                    </div>
                    {errors[group.id] && <p className="text-xs text-red-500 mt-1.5">{errors[group.id]}</p>}
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <div className="space-y-1.5 ml-4 pl-3 border-l-2 border-slate-200">
                  {children.map(c => (
                    <CategoryRow key={c.id} c={c} resolvedColor={group.color} error={errors[c.id]} {...sharedRowProps} />
                  ))}

                  {addingUnder === group.id ? (
                    <AddSubForm parentId={group.id} parentColor={group.color} addForm={addForm} setAddForm={setAddForm} onAdd={addCategory} onCancel={cancelAdd} />
                  ) : (
                    <button
                      onClick={() => { setAddingUnder(group.id); setAddForm({ name: '', color: '#f59e0b' }) }}
                      className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 font-medium active:text-blue-600 transition-colors"
                    >
                      <Plus size={13} /> Add sub-category
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {ungrouped.length > 0 && (
          <div className="space-y-1.5">
            {groups.length > 0 && <p className="text-xs font-semibold text-slate-400 px-1 pt-1">Ungrouped</p>}
            {ungrouped.map(c => (
              <CategoryRow key={c.id} c={c} error={errors[c.id]} {...sharedRowProps} />
            ))}
          </div>
        )}

        {categories.length === 0 && addingUnder !== 'new-group' && (
          <div className="text-center py-10 text-slate-400">
            <Tag size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No categories yet. Add a group to start.</p>
          </div>
        )}
      </div>
    </div>
  )
}
