import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const path = typeof body.path === 'string' ? body.path.slice(0, 300) : ''
  const query = typeof body.query === 'string' && body.query ? body.query.slice(0, 500) : null
  const referrer = typeof body.referrer === 'string' && body.referrer ? body.referrer.slice(0, 500) : null

  if (!path || !path.startsWith('/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null
  const country = req.headers.get('x-vercel-ip-country') ?? null

  const { error } = await supabase.from('page_visits').insert({
    user_id: user.id,
    path,
    query,
    referrer,
    user_agent: userAgent,
    country,
  })

  if (error) {
    console.error('[page-visits] insert failed:', error.code, error.message, error.details)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
