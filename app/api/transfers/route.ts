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

  const body = await req.json()
  const { from_person, amount, date, notes } = body

  if (!from_person?.trim()) return NextResponse.json({ error: 'From person required' }, { status: 400 })
  if (!amount) return NextResponse.json({ error: 'Amount required' }, { status: 400 })

  const { data: owner } = await supabase
    .from('people')
    .select('part_id')
    .eq('name', from_person.trim())
    .eq('person_type', 'owner')
    .single()

  if (!owner?.part_id)
    return NextResponse.json({ error: `${from_person} has no project part assigned. Update their profile in Settings → People first.` }, { status: 400 })

  const part_id = owner.part_id

  const { data, error } = await supabase.from('transfers').insert({
    part_id, from_person: from_person || null, amount: Number(amount),
    date: date || new Date().toISOString().slice(0, 10),
    notes: notes || null, created_by: user.id,
  }).select('*, project_parts(*)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'CREATE', entity_type: 'transfer', entity_id: data.id,
    entity_date: data.date,
    summary: `Added transfer of PKR ${amount} for part`,
    performed_by: user.id,
  })

  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || profile?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, from_person, amount, date, notes } = body

  const { data: owner } = await supabase
    .from('people')
    .select('part_id')
    .eq('name', from_person.trim())
    .eq('person_type', 'owner')
    .single()

  if (!owner?.part_id)
    return NextResponse.json({ error: `${from_person} has no project part assigned.` }, { status: 400 })

  const part_id = owner.part_id

  const { data: before } = await supabase.from('transfers').select('*').eq('id', id).single()
  const { data, error } = await supabase.from('transfers').update({
    part_id, from_person: from_person || null, amount: Number(amount),
    date, notes: notes || null, updated_at: new Date().toISOString(),
  }).eq('id', id).select('*, project_parts(*)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'UPDATE', entity_type: 'transfer', entity_id: id,
    entity_date: date,
    summary: `Updated transfer of PKR ${amount}`,
    changes: { before, after: data },
    performed_by: user.id,
  })

  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || profile?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const { data: before } = await supabase.from('transfers').select('*').eq('id', id).single()
  const { error } = await supabase.from('transfers').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'DELETE', entity_type: 'transfer', entity_id: id,
    summary: `Deleted transfer of PKR ${before?.amount}`,
    changes: { before },
    performed_by: user.id,
  })

  return NextResponse.json({ ok: true })
}
