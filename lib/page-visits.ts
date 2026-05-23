import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function recordServerPageVisit(path: string, query?: string | null) {
  if (!path.startsWith('/')) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const headersList = await headers()
  const userAgent = headersList.get('user-agent')?.slice(0, 500) ?? null
  const country = headersList.get('x-vercel-ip-country') ?? null
  const referrer = headersList.get('referer')?.slice(0, 500) ?? null

  const { error } = await supabase.from('page_visits').insert({
    user_id: user.id,
    path: path.slice(0, 300),
    query: query ? query.slice(0, 500) : null,
    referrer,
    user_agent: userAgent,
    country,
  })

  if (error) {
    console.error('[page-visits] server insert failed:', error.code, error.message, error.details)
  }
}
