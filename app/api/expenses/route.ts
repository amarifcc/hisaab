import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Actor = {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string } | null
  profile: { role?: string; part_id?: string | null } | null
}

async function getActor(): Promise<Actor> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }
  const { data: profile } = await supabase.from('profiles').select('role, part_id').eq('id', user.id).single()
  return { supabase, user, profile }
}

// allocations: Array<{ part_id: string; amount: number }>
export async function POST(req: Request) {
  const { supabase, user, profile } = await getActor()
  const role = profile?.role
  if (!user || (role !== 'supervisor' && role !== 'owner'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const isOwner = role === 'owner'
  if (isOwner && !profile?.part_id)
    return NextResponse.json({ error: 'No project part assigned to your account' }, { status: 403 })

  const body = await req.json()
  const { description, total_amount, paid_to, category_id, date, notes } = body

  // Owners always write a single allocation to their own part; never trust the client allocations/source.
  const source = isOwner ? 'owner' : 'supervisor'
  const allocations: { part_id: string; amount: number }[] = isOwner
    ? [{ part_id: profile!.part_id!, amount: Number(total_amount) }]
    : body.allocations

  if (!description || !total_amount || !allocations?.length)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const allocationTotal = allocations.reduce((s: number, a: { amount: number }) => s + Number(a.amount), 0)
  if (Math.abs(allocationTotal - Number(total_amount)) > 0.01)
    return NextResponse.json({ error: 'Allocation amounts must sum to total' }, { status: 400 })

  const { data: expense, error } = await supabase.from('expenses').insert({
    description, total_amount: Number(total_amount),
    paid_to: paid_to || null, category_id: category_id || null,
    date: date || new Date().toISOString().slice(0, 10),
    notes: notes || null, source, created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allocRows = allocations.map((a: { part_id: string; amount: number }) => ({
    expense_id: expense.id, part_id: a.part_id, amount: Number(a.amount),
  }))
  const { error: allocError } = await supabase.from('expense_allocations').insert(allocRows)
  if (allocError) return NextResponse.json({ error: allocError.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'CREATE', entity_type: 'expense', entity_id: expense.id,
    entity_date: expense.date,
    summary: `Added expense "${description}" PKR ${total_amount}`,
    performed_by: user.id,
  })

  const { data: enriched } = await supabase
    .from('expenses')
    .select('*, categories(*), expense_allocations(*, project_parts(*))')
    .eq('id', expense.id)
    .single()
  return NextResponse.json(enriched ?? expense)
}

export async function PUT(req: Request) {
  const { supabase, user, profile } = await getActor()
  const role = profile?.role
  if (!user || (role !== 'supervisor' && role !== 'owner'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const isOwner = role === 'owner'
  if (isOwner && !profile?.part_id)
    return NextResponse.json({ error: 'No project part assigned to your account' }, { status: 403 })

  const body = await req.json()
  const { id, description, total_amount, paid_to, category_id, date, notes } = body

  const { data: before } = await supabase.from('expenses').select('*').eq('id', id).single()

  // Owners may only edit their own owner-source rows; force the allocation back to their part.
  if (isOwner && (before?.source !== 'owner' || before?.created_by !== user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const allocations: { part_id: string; amount: number }[] = isOwner
    ? [{ part_id: profile!.part_id!, amount: Number(total_amount) }]
    : body.allocations

  const allocationTotal = allocations.reduce((s: number, a: { amount: number }) => s + Number(a.amount), 0)
  if (Math.abs(allocationTotal - Number(total_amount)) > 0.01)
    return NextResponse.json({ error: 'Allocation amounts must sum to total' }, { status: 400 })

  const { data, error } = await supabase.from('expenses').update({
    description, total_amount: Number(total_amount),
    paid_to: paid_to || null, category_id: category_id || null,
    date, notes: notes || null, updated_at: new Date().toISOString(),
  }).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Replace allocations
  await supabase.from('expense_allocations').delete().eq('expense_id', id)
  const allocRows = allocations.map((a: { part_id: string; amount: number }) => ({
    expense_id: id, part_id: a.part_id, amount: Number(a.amount),
  }))
  await supabase.from('expense_allocations').insert(allocRows)

  await supabase.from('activity_logs').insert({
    action: 'UPDATE', entity_type: 'expense', entity_id: id,
    entity_date: date,
    summary: `Updated expense "${description}" PKR ${total_amount}`,
    changes: { before, after: data },
    performed_by: user.id,
  })

  const { data: enriched } = await supabase
    .from('expenses')
    .select('*, categories(*), expense_allocations(*, project_parts(*))')
    .eq('id', id)
    .single()
  return NextResponse.json(enriched ?? data)
}

export async function DELETE(req: Request) {
  const { supabase, user, profile } = await getActor()
  const role = profile?.role
  if (!user || (role !== 'supervisor' && role !== 'owner'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const isOwner = role === 'owner'

  const { id } = await req.json()
  const { data: before } = await supabase.from('expenses').select('*').eq('id', id).single()

  if (isOwner && (before?.source !== 'owner' || before?.created_by !== user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('expenses').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'DELETE', entity_type: 'expense', entity_id: id,
    entity_date: before?.date,
    summary: `Deleted expense "${before?.description}" PKR ${before?.total_amount}`,
    changes: { before },
    performed_by: user.id,
  })

  return NextResponse.json({ ok: true })
}
