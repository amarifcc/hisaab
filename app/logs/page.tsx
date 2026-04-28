export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export default async function LogsPage() {
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from('activity_logs')
    .select('*, profiles(name)')
    .order('performed_at', { ascending: false })
    .limit(200)

  const actionColor = { CREATE: 'text-emerald-600 bg-emerald-50', UPDATE: 'text-blue-600 bg-blue-50', DELETE: 'text-red-600 bg-red-50' }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 safe-top">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <a href="/" className="text-blue-700 text-sm font-medium">← Back</a>
          <h1 className="text-xl font-bold text-slate-900">Activity Log</h1>
        </div>

        {(!logs || logs.length === 0) && (
          <p className="text-center text-slate-400 text-sm py-10">No activity yet</p>
        )}

        <div className="space-y-2">
          {(logs ?? []).map(log => {
            const color = actionColor[log.action as keyof typeof actionColor] ?? 'text-slate-600 bg-slate-50'
            const profile = (log as any).profiles
            return (
              <div key={log.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>{log.action}</span>
                      <span className="text-xs text-slate-500 capitalize">{log.entity_type}</span>
                    </div>
                    <p className="text-sm text-slate-800">{log.summary}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {profile?.name ?? 'Unknown'} · {new Date(log.performed_at).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
