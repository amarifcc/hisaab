export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { dateStart, dateEnd } from '@/lib/date-ranges'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatVisitTime(value: string) {
  return new Date(value).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Karachi',
  })
}

// Parse a friendly device name from user-agent
function parseDevice(ua: string | null): string {
  if (!ua) return 'Unknown'

  // iOS
  if (ua.includes('iPhone')) return 'iPhone'
  if (ua.includes('iPad')) return 'iPad'

  // Android — extract model from e.g. "Linux; Android 13; SM-S918B Build/..."
  if (ua.includes('Android')) {
    const match = ua.match(/Android[^;]*;\s*([^)]+?)(?:\s+Build|\s+wv|\))/i)
    if (match) {
      const raw = match[1].trim()
      if (!raw || raw.toLowerCase().startsWith('linux')) return 'Android'
      // Trim to 28 chars to keep it readable
      return raw.length > 28 ? raw.slice(0, 28) : raw
    }
    return 'Android'
  }

  // Desktop
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Macintosh') || ua.includes('Mac OS X')) return 'Mac'
  if (ua.includes('Linux')) return 'Linux'

  return 'Unknown'
}

// Country code → flag emoji (works without any library)
function countryFlag(code: string): string {
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('')
}

const COUNTRY_NAMES: Record<string, string> = {
  PK: 'Pakistan', SA: 'Saudi Arabia', AE: 'UAE',
  US: 'United States', GB: 'United Kingdom', IN: 'India',
  DE: 'Germany', FR: 'France', CA: 'Canada', AU: 'Australia',
  SG: 'Singapore', MY: 'Malaysia', QA: 'Qatar', KW: 'Kuwait',
  BH: 'Bahrain', OM: 'Oman', EG: 'Egypt', TR: 'Turkey',
}

function countryLabel(code: string | null): string | null {
  if (!code) return null
  const flag = countryFlag(code)
  const name = COUNTRY_NAMES[code.toUpperCase()] ?? code
  return `${flag} ${name}`
}

// Compute date range from a simple period slug
function pktToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date())
}
function pktDaysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(d)
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
  if (period === 'today') return { from: today, to: today }
  if (period === 'week')  return { from: pktDaysAgo(6), to: today }
  if (period === 'month') return { from: pktDaysAgo(29), to: today }
  return {}
}

export default async function VisitsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
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

  const userId = param(params.user) ?? 'all'
  const path   = param(params.path)   ?? 'all'
  const period = (param(params.period) ?? 'all') as Period

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
  if (from) query = query.gte('visited_at', dateStart(from)!)
  if (to)   query = query.lte('visited_at', dateEnd(to)!)

  const { data: visits } = await query

  const uniqueBasePaths = [...new Set(
    (allPaths ?? []).map(row => row.path ?? '').filter(Boolean)
  )].sort()

  const profileMap  = new Map((profiles ?? []).map(p => [p.id, p]))
  const totalShown  = visits?.length ?? 0
  const atCap       = totalShown === 300

  const uniqueUsers = new Set(visits?.map(v => v.user_id)).size
  const pathCounts: Record<string, number> = {}
  for (const v of visits ?? []) {
    const p = v.path ?? ''
    pathCounts[p] = (pathCounts[p] ?? 0) + 1
  }
  const topPath = Object.entries(pathCounts).sort((a, b) => b[1] - a[1])[0]

  // Build base params for period links (preserve user/path filters)
  function periodHref(p: Period) {
    const sp = new URLSearchParams()
    if (userId !== 'all') sp.set('user', userId)
    if (path   !== 'all') sp.set('path', path)
    if (p !== 'all') sp.set('period', p)
    const q = sp.toString()
    return q ? `/visits?${q}` : '/visits'
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Page Visits</h1>
          <p className="text-xs text-slate-400">Latest page views</p>
        </div>
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

      {/* User + Page filters */}
      <form action="/visits" method="get" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 space-y-2">
        {/* Preserve period in form submission */}
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

      {(!visits || visits.length === 0) && (
        <p className="text-center text-slate-400 text-sm py-10">No visits found</p>
      )}

      <div className="space-y-2">
        {(visits ?? []).map(visit => {
          const p      = profileMap.get(visit.user_id)
          const device = parseDevice(visit.user_agent)
          const country = countryLabel(visit.country)
          const joinedPath = `${visit.path}${visit.query ? `?${visit.query}` : ''}`
          return (
            <div key={visit.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{joinedPath}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p?.name ?? 'Unknown'}</p>
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-xs text-slate-400">
                    <span>{device}</span>
                    {country && <span>{country}</span>}
                    <span>{formatVisitTime(visit.visited_at)}</span>
                  </div>
                </div>
                <span className="text-[11px] rounded-full bg-slate-50 text-slate-500 px-2 py-0.5 capitalize flex-shrink-0">{p?.role ?? 'user'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
