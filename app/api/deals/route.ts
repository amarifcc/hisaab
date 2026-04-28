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
  if (!user || (profile as any)?.role !== 'supervisor')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, person_name, part_id, agreed_amount, date, notes } = await req.json()
  if (!name?.trim() || !part_id || !agreed_amount)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data, error } = await supabase.from('deals').insert({
    name: name.trim(),
    person_name: person_name?.trim() || null,
    part_id,
    agreed_amount: Number(agreed_amount),
    date: date || new Date().toISOString().slice(0, 10),
    notes: notes || null,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'CREATE', entity_type: 'deal', entity_id: data.id,
    summary: `Added deal "${name}" PKR ${agreed_amount}${person_name ? ` with ${person_name}` : ''}`,
    performed_by: user.id,
  })

  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || (profile as any)?.role !== 'supervisor')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, name, person_name, part_id, agreed_amount, date, notes } = await req.json()

  const { data: before } = await supabase.from('deals').select('*').eq('id', id).single()
  const { data, error } = await supabase.from('deals').update({
    name: name.trim(),
    person_name: person_name?.trim() || null,
    part_id,
    agreed_amount: Number(agreed_amount),
    date,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'UPDATE', entity_type: 'deal', entity_id: id,
    summary: `Updated deal "${name}" PKR ${agreed_amount}`,
    changes: { before, after: data },
    performed_by: user.id,
  })

  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || (profile as any)?.role !== 'supervisor')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const { data: before } = await supabase.from('deals').select('*').eq('id', id).single()
  const { error } = await supabase.from('deals').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'DELETE', entity_type: 'deal', entity_id: id,
    summary: `Deleted deal "${before?.name}"`,
    changes: { before },
    performed_by: user.id,
  })

  return NextResponse.json({ ok: true })
}
