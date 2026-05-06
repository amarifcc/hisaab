export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { AlertTriangle, Clock, User } from 'lucide-react'
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

const ACTIONS   = ['CREATE', 'UPDATE', 'DELETE'] as const
const ENTITIES  = ['expense', 'transfer', 'deal', 'deal_revision', 'category', 'project_part'] as const
const PERIODS   = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'Week'  },
  { id: 'month', label: 'Month' },
  { id: 'all',   label: 'All time' },
] as const
type Period = typeof PERIODS[number]['id']

const actionStyle: Record<string, string> = {
  CREATE: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  UPDATE: 'text-blue-700 bg-blue-50 border-blue-100',
  DELETE: 'text-red-700 bg-red-50 border-red-100',
}

// ── Period helpers ──────────────────────────────────────────────────────────
function pktToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date())
}
function pktDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(d)
}
function periodFrom(period: Period): string | null {
  if (period === 'today') return pktToday()
  if (period === 'week')  return pktDaysAgo(6)
  if (period === 'month') return pktDaysAgo(29)
  return null
}

// ── Formatting helpers ──────────────────────────────────────────────────────
function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
function formatEntity(entity: string) {
  return entity.replaceAll('_', ' ')
}
function formatLogTime(value: string) {
  return new Date(value).toLocaleString('en-PK', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Karachi',
  }) + ' PKT'
}
function compactJson(value: Json | null) {
  if (!value) return ''
  return JSON.stringify(value, null, 2)
}

// ── Change diff UI ──────────────────────────────────────────────────────────
const SKIP_FIELDS = new Set([
  'id', 'created_at', 'updated_at', 'created_by',
  'ref_number', 'expense_allocations', 'project_parts', 'deal_revisions',
])

const FIELD_LABELS: Record<string, string> = {
  description:      'Description',
  total_amount:     'Amount',
  paid_to:          'Paid to',
  category_id:      'Category',
  date:             'Date',
  notes:            'Notes',
  from_person:      'From',
  amount:           'Amount',
  part_id:          'Part',
  name:             'Name',
  person_name:      'Person',
  agreed_amount:    'Agreed amount',
  scope_description:'Scope',
  amount_delta:     'Amount delta',
  revision_number:  'Revision',
}

const MONEY_FIELDS = new Set(['total_amount', 'amount', 'agreed_amount', 'amount_delta'])

function fmtVal(key: string, val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (MONEY_FIELDS.has(key)) return `PKR ${Number(val).toLocaleString()}`
  return String(val)
}

function ChangeDiff({ changes }: { changes: Json | null }) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null
  const c = changes as Record<string, Json>
  const before = c.before
  const after  = c.after
  if (!before || !after || typeof before !== 'object' || Array.isArray(before)) return null
  if (typeof after !== 'object' || Array.isArray(after)) return null

  const b = before as Record<string, Json>
  const a = after  as Record<string, Json>

  const diffs: { key: string; from: string; to: string }[] = []
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (SKIP_FIELDS.has(key)) continue
    if (JSON.stringify(b[key]) === JSON.stringify(a[key])) continue
    diffs.push({ key, from: fmtVal(key, b[key]), to: fmtVal(key, a[key]) })
  }
  if (!diffs.length) return null

  return (
    <div className="mt-2 space-y-1 rounded-xl bg-slate-50 px-3 py-2">
      {diffs.map(({ key, from, to }) => (
        <div key={key} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0 text-xs">
          <span className="text-slate-400 shrink-0">{FIELD_LABELS[key] ?? key}:</span>
          <span className="text-slate-400 line-through">{from}</span>
          <span className="text-slate-300">→</span>
          <span className="text-slate-700 font-medium">{to}</span>
        </div>
      ))}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
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

  const action      = param(params.action)  ?? 'all'
  const entity      = param(params.entity)  ?? 'all'
  const userId      = param(params.user)    ?? 'all'
  const search      = (param(params.q)      ?? '').trim()
  const unusualOnly = param(params.unusual) === '1'
  const period      = (param(params.period) ?? 'week') as Period

  const { data: profiles } = await supabase.from('profiles').select('id, name, role').order('name')

  // Build period href preserving other filters
  function periodHref(p: Period) {
    const sp = new URLSearchParams()
    if (action !== 'all')   sp.set('action', action)
    if (entity !== 'all')   sp.set('entity', entity)
    if (userId !== 'all')   sp.set('user',   userId)
    if (search)             sp.set('q',      search)
    if (unusualOnly)        sp.set('unusual','1')
    sp.set('period', p)
    const q = sp.toString()
    return q ? `/logs?${q}` : '/logs'
  }

  let query = supabase
    .from('activity_logs')
    .select('*, profiles(name)')
    .order('performed_at', { ascending: false })
    .limit(300)

  if (ACTIONS.includes(action as (typeof ACTIONS)[number]))   query = query.eq('action', action)
  if (ENTITIES.includes(entity as (typeof ENTITIES)[number])) query = query.eq('entity_type', entity)
  if (userId !== 'all')  query = query.eq('performed_by', userId)
  if (search)            query = query.or(`summary.ilike.%${search}%,entity_type.ilike.%${search}%`)
  if (unusualOnly)       query = query.not('entity_date', 'is', null)

  // Unusual mode scans all time — backdated entries can be anywhere in history
  const from = unusualOnly ? null : periodFrom(period)
  if (from) query = query.gte('performed_at', `${from}T00:00:00+05:00`)

  const { data } = await query
  let logs = (data ?? []) as LogRow[]
  if (unusualOnly) logs = logs.filter(isUnusual)

  const total   = logs.length
  const creates = logs.filter(l => l.action === 'CREATE').length
  const updates = logs.filter(l => l.action === 'UPDATE').length
  const deletes = logs.filter(l => l.action === 'DELETE').length

  return (
    <div className="px-4 pt-5 pb-8">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Write Logs</h1>
        <p className="text-xs text-slate-400">Create, update and delete audit trail</p>
      </div>

      {/* Period pills */}
      <div className="flex gap-1.5 mb-3">
        {PERIODS.map(p => (
          <Link
            key={p.id}
            href={periodHref(p.id)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p.id
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <form action="/logs" method="get" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 space-y-2">
        {period !== 'all' && <input type="hidden" name="period" value={period} />}
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

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <LogMetric label="Total"   value={total}   />
        <LogMetric label="New"     value={creates} />
        <LogMetric label="Edited"  value={updates} />
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
          const color   = actionStyle[log.action] ?? 'text-slate-600 bg-slate-50 border-slate-100'
          const unusual = isUnusual(log)
          const changes = compactJson(log.changes)
          return (
            <div key={log.id} className="bg-white rounded-xl px-4 py-3.5 border border-slate-100">

              {/* Row 1: action + entity (left) · unusual badge (right) */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${color}`}>
                    {log.action}
                  </span>
                  <span className="text-xs text-slate-400 capitalize">{formatEntity(log.entity_type)}</span>
                </div>
                {unusual && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded flex-shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    backdated
                  </span>
                )}
              </div>

              {/* Row 2: who (left) · when (right) */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <User className="w-3 h-3 flex-shrink-0" />
                  <span>{log.profiles?.name ?? 'Unknown'}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>{formatLogTime(log.performed_at)}</span>
                </span>
              </div>

              {/* Row 3: summary */}
              <p className="text-sm font-medium text-slate-800 mb-2">{log.summary}</p>

              {/* Change diff + raw JSON */}
              {log.action === 'UPDATE' && log.changes && (
                <div className="mt-3">
                  <ChangeDiff changes={log.changes} />
                </div>
              )}
              {changes && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-slate-400 flex items-center gap-2">
                    <span>Raw JSON</span>
                    {log.entity_id && (
                      <span className="text-[10px] text-slate-300 font-mono">{log.entity_id.slice(0, 8)}</span>
                    )}
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 whitespace-pre-wrap">
                    {changes}
                  </pre>
                </details>
              )}
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
