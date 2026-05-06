export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { ActivityLog, Json } from '@/lib/types'

// Flag entries where the entity date is more than 48 h before it was logged
function isUnusual(log: ActivityLog): boolean {
  if (!log.entity_date) return false
  if (!['CREATE', 'UPDATE'].includes(log.action)) return false
  if (!['expense', 'transfer', 'deal'].includes(log.entity_type)) return false
  const performed = new Date(log.performed_at).getTime()
  const entity = new Date(log.entity_date).getTime()
  return (performed - entity) > 48 * 60 * 60 * 1000
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
type LogProfile = { name: string | null }
type LogRow = ActivityLog & { profiles: LogProfile | null }

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const
const ENTITIES = ['expense', 'transfer', 'deal', 'deal_revision', 'category', 'project_part'] as const

const actionStyle: Record<string, string> = {
  CREATE: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  UPDATE: 'text-blue-700 bg-blue-50 border-blue-100',
  DELETE: 'text-red-700 bg-red-50 border-red-100',
}

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatEntity(entity: string) {
  return entity.replaceAll('_', ' ')
}

function formatLogTime(value: string) {
  return new Date(value).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Karachi',
  })
}

function compactJson(value: Json | null) {
  if (!value) return ''
  return JSON.stringify(value, null, 2)
}

export default async function LogsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()

  // Supervisor-only guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div className="px-4 pt-5"><p className="text-sm text-slate-400">Login required.</p></div>
  }
  const { data: selfProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((selfProfile as { role?: string } | null)?.role !== 'supervisor') {
    return <div className="px-4 pt-5"><p className="text-sm text-slate-400">Supervisor access required.</p></div>
  }

  const action = param(params.action) ?? 'all'
  const entity = param(params.entity) ?? 'all'
  const userId = param(params.user) ?? 'all'
  const search = (param(params.q) ?? '').trim()
  const unusualOnly = param(params.unusual) === '1'

  const { data: profiles } = await supabase.from('profiles').select('id, name, role').order('name')

  let query = supabase
    .from('activity_logs')
    .select('*, profiles(name)')
    .order('performed_at', { ascending: false })
    .limit(300)

  if (ACTIONS.includes(action as (typeof ACTIONS)[number])) query = query.eq('action', action)
  if (ENTITIES.includes(entity as (typeof ENTITIES)[number])) query = query.eq('entity_type', entity)
  if (userId !== 'all') query = query.eq('performed_by', userId)
  if (search) query = query.or(`summary.ilike.%${search}%,entity_type.ilike.%${search}%`)
  // Unusual: entity_date exists and logged more than 2 days after entity date
  if (unusualOnly) query = query.not('entity_date', 'is', null)

  const { data } = await query
  let logs = (data ?? []) as LogRow[]
  // Client-side refinement: if unusual filter active, keep only flagged rows
  if (unusualOnly) logs = logs.filter(isUnusual)

  const total = logs.length
  const creates = logs.filter(log => log.action === 'CREATE').length
  const updates = logs.filter(log => log.action === 'UPDATE').length
  const deletes = logs.filter(log => log.action === 'DELETE').length

  return (
    <div className="px-4 pt-5 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Write Logs</h1>
          <p className="text-xs text-slate-400">All time · create, update and delete audit trail</p>
        </div>
      </div>

      <form action="/logs" method="get" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 space-y-2">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search summary or entity"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Action</span>
            <select name="action" defaultValue={action} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900">
              <option value="all">All actions</option>
              {ACTIONS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Entity</span>
            <select name="entity" defaultValue={entity} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900">
              <option value="all">All entities</option>
              {ENTITIES.map(item => <option key={item} value={item}>{formatEntity(item)}</option>)}
            </select>
          </label>
          <label className="space-y-1 col-span-2">
            <span className="text-[11px] font-medium text-slate-400">User</span>
            <select name="user" defaultValue={userId} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900">
              <option value="all">All users</option>
              {(profiles ?? []).map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2.5 px-1 py-1 cursor-pointer">
          <input
            type="checkbox"
            name="unusual"
            value="1"
            defaultChecked={unusualOnly}
            className="w-4 h-4 rounded accent-amber-500"
          />
          <span className="text-sm text-slate-700">Unusual only <span className="text-slate-400 text-xs">(backdated &gt;48 h)</span></span>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-xl bg-blue-700 text-white text-sm font-medium py-2">Apply</button>
          <Link href="/logs" className="rounded-xl border border-slate-200 text-slate-500 text-sm font-medium px-4 py-2">Reset</Link>
        </div>
      </form>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <LogMetric label="Total" value={total} />
        <LogMetric label="New" value={creates} />
        <LogMetric label="Edited" value={updates} />
        <LogMetric label="Deleted" value={deletes} />
      </div>

      {total === 300 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
          Showing 300 of more results — filter by action, entity or user to narrow down
        </p>
      )}

      {logs.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-10">No matching write logs</p>
      )}

      <div className="space-y-2">
        {logs.map(log => {
          const color = actionStyle[log.action] ?? 'text-slate-600 bg-slate-50 border-slate-100'
          const changes = compactJson(log.changes)
          return (
            <div key={log.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${color}`}>{log.action}</span>
                    <span className="text-xs text-slate-500 capitalize">{formatEntity(log.entity_type)}</span>
                    {isUnusual(log) && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" />
                        backdated
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-800">{log.summary}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {log.profiles?.name ?? 'Unknown'} · {formatLogTime(log.performed_at)}
                  </p>
                  {changes && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-slate-400">Changes</summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 whitespace-pre-wrap">
                        {changes}
                      </pre>
                    </details>
                  )}
                </div>
                {log.entity_id && <span className="text-[10px] text-slate-300 font-mono">{log.entity_id.slice(0, 8)}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LogMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-base font-bold text-slate-900">{value}</p>
    </div>
  )
}
