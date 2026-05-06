export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Clock, User, Smartphone, Monitor } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { dateStart, dateEnd } from '@/lib/date-ranges'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

// ── Readable query params ───────────────────────────────────────────────────
function formatQueryParams(
  raw: string,
  profileMap: Map<string, { name: string | null }>
): string {
  const params = new URLSearchParams(raw)
  const parts: string[] = []

  const period = params.get('period')
  if (period) parts.push(`period: ${period}`)

  const userId = params.get('user')
  if (userId) {
    const name = userId === 'all' ? 'all' : (profileMap.get(userId)?.name ?? userId.slice(0, 8))
    parts.push(`user: ${name}`)
  }

  const path = params.get('path')
  if (path) parts.push(`page: ${path}`)

  // Any extra params not already handled
  for (const [key, value] of params.entries()) {
    if (['period', 'user', 'path'].includes(key)) continue
    parts.push(`${key}: ${value}`)
  }

  return parts.join(' · ')
}

// ── Time formatting ─────────────────────────────────────────────────────────
function formatTime(value: string) {
  return new Date(value).toLocaleString('en-PK', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Karachi',
  }) + ' PKT'
}

// ── Brand detection from Android model string ───────────────────────────────
function parseBrand(model: string): string {
  const m = model.toUpperCase()
  if (m.startsWith('SM-') || m.startsWith('SAMSUNG'))          return 'Samsung'
  if (m.startsWith('PIXEL'))                                    return 'Google'
  if (m.startsWith('ONEPLUS') || m.startsWith('ONE PLUS'))     return 'OnePlus'
  if (m.startsWith('REDMI') || m.startsWith('MI ') || m.startsWith('MI_')) return 'Xiaomi'
  if (m.startsWith('POCO'))                                     return 'POCO'
  if (m.startsWith('VIVO') || m.startsWith('V2') || m.startsWith('V1')) return 'vivo'
  if (m.startsWith('CPH') || m.startsWith('OPPO'))             return 'OPPO'
  if (m.startsWith('RMX') || m.startsWith('REALME'))           return 'Realme'
  if (m.startsWith('HUAWEI') || m.startsWith('CLT') || m.startsWith('ANA') || m.startsWith('ELS')) return 'Huawei'
  if (m.startsWith('NOKIA'))                                    return 'Nokia'
  if (m.startsWith('MOTO') || m.startsWith('XT'))              return 'Motorola'
  if (m.startsWith('TECNO'))                                    return 'Tecno'
  if (m.startsWith('INFINIX'))                                  return 'Infinix'
  if (m.startsWith('HONOR'))                                    return 'Honor'
  if (m.startsWith('ITEL'))                                     return 'itel'
  return ''
}

// ── Device name + type from user-agent ─────────────────────────────────────
type DeviceInfo = { label: string; type: 'mobile' | 'desktop' }

function parseDevice(ua: string | null): DeviceInfo {
  if (!ua) return { label: 'Unknown', type: 'mobile' }

  if (ua.includes('iPhone')) return { label: 'iPhone', type: 'mobile' }
  if (ua.includes('iPad'))   return { label: 'iPad',   type: 'mobile' }

  if (ua.includes('Android')) {
    const match = ua.match(/Android[^;]*;\s*([^)]+?)(?:\s+Build|\s+wv|\))/i)
    if (match) {
      const raw = match[1].trim()
      if (!raw || raw.toLowerCase().startsWith('linux')) return { label: 'Android', type: 'mobile' }
      const model  = raw.length > 24 ? raw.slice(0, 24) : raw
      const brand  = parseBrand(model)
      const label  = brand ? `${brand} ${model}` : model
      return { label, type: 'mobile' }
    }
    return { label: 'Android', type: 'mobile' }
  }

  if (ua.includes('Windows'))                              return { label: 'Windows', type: 'desktop' }
  if (ua.includes('Macintosh') || ua.includes('Mac OS X')) return { label: 'Mac',     type: 'desktop' }
  if (ua.includes('Linux'))                                return { label: 'Linux',   type: 'desktop' }

  return { label: 'Unknown', type: 'mobile' }
}

// ── Country display ─────────────────────────────────────────────────────────
const COUNTRY_NAMES: Record<string, string> = {
  PK: 'Pakistan',      SA: 'Saudi Arabia', AE: 'UAE',
  US: 'United States', GB: 'UK',           IN: 'India',
  DE: 'Germany',       FR: 'France',       CA: 'Canada',
  AU: 'Australia',     SG: 'Singapore',    MY: 'Malaysia',
  QA: 'Qatar',         KW: 'Kuwait',       BH: 'Bahrain',
  OM: 'Oman',          EG: 'Egypt',        TR: 'Turkey',
}

function countryFlag(code: string): string {
  if (code.length !== 2) return ''
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('')
}

function countryLabel(code: string | null): { flag: string; name: string } | null {
  if (!code || code.length < 2) return null
  return {
    flag: countryFlag(code),
    name: COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase(),
  }
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
function pktDateOf(value: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(value))
}
function dateGroupLabel(date: string): string {
  const today     = pktToday()
  const yesterday = pktDaysAgo(1)
  if (date === today)     return 'Today'
  if (date === yesterday) return 'Yesterday'
  return new Date(date + 'T12:00:00').toLocaleDateString('en-PK', {
    day: 'numeric', month: 'long',
  })
}

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'Week'  },
  { id: 'month', label: 'Month' },
  { id: 'all',   label: 'All time' },
] as const
type Period = typeof PERIODS[number]['id']

function periodRange(period: Period): { from?: string; to?: string } {
  const today = pktToday()
  if (period === 'today') return { from: today,          to: today }
  if (period === 'week')  return { from: pktDaysAgo(6),  to: today }
  if (period === 'month') return { from: pktDaysAgo(29), to: today }
  return {}
}

// ── Page ────────────────────────────────────────────────────────────────────
export default async function VisitsPage({ searchParams }: { searchParams: SearchParams }) {
  const params   = await searchParams
  const supabase = await createClient()

  // Supervisor-only guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role?: string } | null)?.role !== 'supervisor') {
    return (
      <div className="px-4 pt-5">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Page Visits</h1>
        <p className="text-sm text-slate-400">Supervisor access required.</p>
      </div>
    )
  }

  const userId = param(params.user)   ?? 'all'
  const path   = param(params.path)   ?? 'all'
  const period = (param(params.period) ?? 'week') as Period

  const [{ data: profiles }, { data: allPaths }] = await Promise.all([
    supabase.from('profiles').select('id, name, role').order('name'),
    supabase.from('page_visits').select('path').limit(2000),
  ])

  const { from, to } = periodRange(period)

  let query = supabase
    .from('page_visits')
    .select('*, profiles(name, role)')
    .order('visited_at', { ascending: false })
    .limit(300)

  if (userId !== 'all') query = query.eq('user_id', userId)
  if (path   !== 'all') query = query.eq('path', path)
  if (from)  query = query.gte('visited_at', dateStart(from)!)
  if (to)    query = query.lte('visited_at', dateEnd(to)!)

  const { data: visits } = await query

  const uniqueBasePaths = [...new Set(
    (allPaths ?? []).map(row => row.path ?? '').filter(Boolean)
  )].sort()

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  const totalShown = visits?.length ?? 0
  const atCap      = totalShown === 300

  const uniqueUsers = new Set(visits?.map(v => v.user_id)).size
  const pathCounts: Record<string, number> = {}
  for (const v of visits ?? []) {
    const p = v.path ?? ''
    pathCounts[p] = (pathCounts[p] ?? 0) + 1
  }
  const topPath = Object.entries(pathCounts).sort((a, b) => b[1] - a[1])[0]

  // Group by PKT date
  type VisitRow = NonNullable<typeof visits>[number]
  const dateGroups: { date: string; label: string; rows: VisitRow[] }[] = []
  for (const visit of visits ?? []) {
    const d = pktDateOf(visit.visited_at)
    if (dateGroups.at(-1)?.date !== d) {
      dateGroups.push({ date: d, label: dateGroupLabel(d), rows: [] })
    }
    dateGroups.at(-1)!.rows.push(visit)
  }

  function periodHref(p: Period) {
    const sp = new URLSearchParams()
    if (userId !== 'all') sp.set('user', userId)
    if (path   !== 'all') sp.set('path', path)
    sp.set('period', p)
    const q = sp.toString()
    return q ? `/visits?${q}` : '/visits'
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Page Visits</h1>
        <p className="text-xs text-slate-400">Who opened what and when</p>
      </div>

      {/* Filters — period pills + dropdowns in one card */}
      <form action="/visits" method="get" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 space-y-3">
        {/* Period pills */}
        <div>
          <p className="text-[11px] font-medium text-slate-400 mb-1.5">Period</p>
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map(p => (
              <Link
                key={p.id}
                href={periodHref(p.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  period === p.id
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
        {period !== 'all' && <input type="hidden" name="period" value={period} />}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400">User</span>
            <select name="user" defaultValue={userId} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900">
              <option value="all">All users</option>
              {(profiles ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Page</span>
            <select name="path" defaultValue={path} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900">
              <option value="all">All pages</option>
              {uniqueBasePaths.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-xl bg-blue-700 text-white text-sm font-medium py-2">Apply</button>
          <Link href="/visits" className="rounded-xl border border-slate-200 text-slate-500 text-sm font-medium px-4 py-2">Reset</Link>
        </div>
      </form>

      {/* Summary metrics */}
      {totalShown > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
            <p className="text-[11px] text-slate-400">Visits</p>
            <p className="text-base font-bold text-slate-900">{totalShown}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
            <p className="text-[11px] text-slate-400">Users</p>
            <p className="text-base font-bold text-slate-900">{uniqueUsers}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-100 px-3 py-2 min-w-0">
            <p className="text-[11px] text-slate-400">Top page</p>
            <p className="text-sm font-bold text-slate-900 truncate">{topPath ? topPath[0] : '—'}</p>
          </div>
        </div>
      )}

      {atCap && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
          Showing 300 of more results — filter by user, page or period to narrow down
        </p>
      )}
      {totalShown === 0 && (
        <p className="text-center text-slate-400 text-sm py-10">No visits found</p>
      )}

      {/* Date-grouped rows */}
      <div className="space-y-4">
        {dateGroups.map(group => (
          <div key={group.date}>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
              {group.label}
            </p>
            <div className="space-y-2">
              {group.rows.map(visit => {
                const prof    = profileMap.get(visit.user_id)
                const device  = parseDevice(visit.user_agent)
                const country = countryLabel(visit.country)
                const DeviceIcon = device.type === 'desktop' ? Monitor : Smartphone
                const deviceIconClass = device.type === 'desktop'
                  ? 'text-slate-400'
                  : 'text-blue-400'
                return (
                  <div key={visit.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100">
                    {/* Row 1: path (clean, no query) + time */}
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <p className="text-sm font-semibold text-slate-900 truncate">{visit.path}</p>
                      <p className="flex items-center gap-1 text-[11px] text-slate-400 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatTime(visit.visited_at)}
                      </p>
                    </div>
                    {/* Row 2: user (left) · device + country (right) */}
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span className="text-slate-500">{prof?.name ?? 'Unknown'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <DeviceIcon className={`w-3 h-3 flex-shrink-0 ${deviceIconClass}`} />
                        <span>{device.label}</span>
                        {country && (
                          <span className="flex items-center gap-0.5 ml-1">
                            <span>{country.flag}</span>
                            <span>{country.name}</span>
                          </span>
                        )}
                      </span>
                    </div>
                    {/* Query params — translated, hidden by default */}
                    {visit.query && (
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[11px] text-slate-300 select-none">params</summary>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {formatQueryParams(visit.query, profileMap)}
                        </p>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
