import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getSupervisor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return { supabase, user, profile }
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || profile?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, short_name, color, sort_order } = await req.json()
  const { data, error } = await supabase.from('project_parts').insert({
    name, short_name, color: color || '#6366f1', sort_order: sort_order ?? 99,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'CREATE', entity_type: 'project_part', entity_id: data.id,
    summary: `Added project part "${name}"`, performed_by: user.id,
  })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || profile?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, name, short_name, color } = await req.json()
  const { data, error } = await supabase.from('project_parts').update({ name, short_name, color }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || profile?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()

  // Block delete if transfers or expense allocations reference this part
  const [{ count: transferCount }, { count: allocCount }] = await Promise.all([
    supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('part_id', id),
    supabase.from('expense_allocations').select('id', { count: 'exact', head: true }).eq('part_id', id),
  ])
  const total = (transferCount ?? 0) + (allocCount ?? 0)
  if (total > 0) {
    return NextResponse.json({ error: 'Part has linked records', linkedCount: total }, { status: 409 })
  }

  const { data: part } = await supabase.from('project_parts').select('name').eq('id', id).single()
  const { error } = await supabase.from('project_parts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'DELETE', entity_type: 'project_part', entity_id: id,
    summary: `Deleted project part "${(part as any)?.name}"`, performed_by: user.id,
  })
  return NextResponse.json({ ok: true })
}
