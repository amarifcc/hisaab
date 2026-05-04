export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { clearDateRangeHref, dateEnd, dateRangeHref, dateStart, quickDateRanges } from '@/lib/date-ranges'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function VisitsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()

  const userId = param(params.user) ?? 'all'
  const path = param(params.path) ?? 'all'
  const from = param(params.from) ?? ''
  const to = param(params.to) ?? ''
  const quickParams = {
    ...(userId !== 'all' ? { user: userId } : {}),
    ...(path !== 'all' ? { path } : {}),
  }

  const [{ data: profiles }, { data: paths }] = await Promise.all([
    supabase.from('profiles').select('id, name, role').order('name'),
    supabase.from('page_visits').select('path').order('path'),
  ])

  let query = supabase
    .from('page_visits')
    .select('*, profiles(name, role)')
    .order('visited_at', { ascending: false })
    .limit(300)

  if (userId !== 'all') query = query.eq('user_id', userId)
  if (path !== 'all') query = query.eq('path', path)
  if (from) query = query.gte('visited_at', dateStart(from)!)
  if (to) query = query.lte('visited_at', dateEnd(to)!)

  const { data: visits } = await query
  const uniquePaths = [...new Set((paths ?? []).map(row => row.path).filter(Boolean))].sort()
  const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]))

  return (
    <div className="px-4 pt-5 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Page Visits</h1>
          <p className="text-xs text-slate-400">Latest website and page views</p>
        </div>
      </div>

      <form action="/visits" method="get" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400">User</span>
            <select name="user" defaultValue={userId} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white">
              <option value="all">All users</option>
              {(profiles ?? []).map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Page</span>
            <select name="path" defaultValue={path} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white">
              <option value="all">All pages</option>
              {uniquePaths.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <div className="col-span-2 space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Quick dates</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {quickDateRanges().map(range => {
                const active = from === range.from && to === range.to
                return (
                  <Link
                    key={range.label}
                    href={dateRangeHref('/visits', quickParams, range.from, range.to)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}
                  >
                    {range.label}
                  </Link>
                )
              })}
              {(from || to) && (
                <Link
                  href={clearDateRangeHref('/visits', quickParams)}
                  className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500"
                >
                  Clear
                </Link>
              )}
            </div>
          </div>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400">From</span>
            <input name="from" type="date" defaultValue={from} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400">To</span>
            <input name="to" type="date" defaultValue={to} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white" />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-xl bg-blue-700 text-white text-sm font-medium py-2">Apply</button>
          <Link href="/visits" className="rounded-xl border border-slate-200 text-slate-500 text-sm font-medium px-4 py-2">Reset</Link>
        </div>
      </form>

      {(!visits || visits.length === 0) && (
        <p className="text-center text-slate-400 text-sm py-10">No visits found</p>
      )}

      <div className="space-y-2">
        {(visits ?? []).map(visit => {
          const profile = profileMap.get(visit.user_id)
          const joinedPath = `${visit.path}${visit.query ? `?${visit.query}` : ''}`
          return (
            <div key={visit.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{joinedPath}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {profile?.name ?? 'Unknown'} · {new Date(visit.visited_at).toLocaleString('en-PK', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Karachi',
                    })}
                  </p>
                  {visit.referrer && <p className="text-[11px] text-slate-300 mt-1 truncate">from {visit.referrer}</p>}
                </div>
                <span className="text-[11px] rounded-full bg-slate-50 text-slate-500 px-2 py-0.5 capitalize">{profile?.role ?? 'user'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
