'use client'

import { useState } from 'react'
import { Check, X, ShieldCheck, Home, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

type PartLite = { id: string; name: string; short_name: string; color: string }
type AppUser = {
  id: string
  name: string
  role: 'supervisor' | 'owner' | 'viewer'
  part_id: string | null
  project_parts: PartLite | null
}

interface Props {
  initialUsers: AppUser[]
  parts: PartLite[]
  currentUserId: string
}

const ROLE_META: Record<AppUser['role'], { label: string; icon: typeof Eye; chip: string }> = {
  supervisor: { label: 'Supervisor', icon: ShieldCheck, chip: 'bg-blue-50 text-blue-700' },
  owner: { label: 'Owner', icon: Home, chip: 'bg-emerald-50 text-emerald-700' },
  viewer: { label: 'Viewer', icon: Eye, chip: 'bg-slate-100 text-slate-500' },
}

export default function UsersManager({ initialUsers, parts, currentUserId }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<{ role: AppUser['role']; part_id: string }>({ role: 'viewer', part_id: '' })
  const [error, setError] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function startEdit(u: AppUser) {
    setEditing(u.id)
    setForm({ role: u.role, part_id: u.part_id ?? (parts[0]?.id ?? '') })
    setError(prev => ({ ...prev, [u.id]: '' }))
  }

  async function save(id: string) {
    setSaving(true)
    setError(prev => ({ ...prev, [id]: '' }))
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        role: form.role,
        part_id: form.role === 'owner' ? form.part_id : null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setUsers(prev => prev.map(u => (u.id === id ? updated : u)))
      setEditing(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(prev => ({ ...prev, [id]: d.error ?? 'Failed to save' }))
    }
  }

  return (
    <div className="px-4 pt-5 pb-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">App Users</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Set who can log in and what they can do. Owners get write access to their own expenses for one project part.
        </p>
      </div>

      <div className="space-y-2">
        {users.map(u => {
          const meta = ROLE_META[u.role]
          const RoleIcon = meta.icon
          const isSelf = u.id === currentUserId
          return (
            <div key={u.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3">
              {editing === u.id ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">{u.name}</p>

                  {/* Role picker */}
                  <div className="flex gap-2">
                    {(['supervisor', 'owner', 'viewer'] as const).map(r => {
                      const RM = ROLE_META[r]
                      const RIcon = RM.icon
                      return (
                        <button
                          key={r}
                          onClick={() => setForm(f => ({ ...f, role: r }))}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border',
                            form.role === r ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'
                          )}
                        >
                          <RIcon size={13} /> {RM.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Part picker — only for owner */}
                  {form.role === 'owner' && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Assigned part</p>
                      <div className="flex flex-wrap gap-1.5">
                        {parts.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setForm(f => ({ ...f, part_id: p.id }))}
                            className={cn(
                              'px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5',
                              form.part_id === p.id ? 'border-slate-900' : 'border-slate-200'
                            )}
                          >
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {error[u.id] && <p className="text-xs text-red-500">{error[u.id]}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={() => save(u.id)}
                      disabled={saving}
                      className="flex items-center gap-1 text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      <Check size={12} /> Save
                    </button>
                    <button onClick={() => setEditing(null)} className="text-xs text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {u.name} {isSelf && <span className="text-xs text-slate-400">(you)</span>}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium', meta.chip)}>
                        <RoleIcon size={11} /> {meta.label}
                      </span>
                      {u.role === 'owner' && u.project_parts && (
                        <span
                          className="text-[11px] px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: u.project_parts.color }}
                        >
                          {u.project_parts.short_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isSelf && (
                    <button onClick={() => startEdit(u)} className="text-xs font-medium text-blue-700 flex-shrink-0">
                      Edit access
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {users.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 px-4 py-8 text-center">
            <p className="text-sm text-slate-400">No app users yet. People who sign up will appear here as viewers.</p>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        <X size={11} className="inline -mt-0.5" /> Owners must first sign up themselves (they start as viewers with no access),
        then you promote them here and assign their part.
      </p>
    </div>
  )
}
