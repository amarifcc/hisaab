import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getSupervisor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return { supabase, user, profile }
}

// allocations: Array<{ part_id: string; amount: number }>
export async function POST(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || profile?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { description, total_amount, paid_to, category_id, date, notes, allocations } = body

  if (!description || !total_amount || !allocations?.length)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const allocationTotal = allocations.reduce((s: number, a: { amount: number }) => s + Number(a.amount), 0)
  if (Math.abs(allocationTotal - Number(total_amount)) > 0.01)
    return NextResponse.json({ error: 'Allocation amounts must sum to total' }, { status: 400 })

  const { data: expense, error } = await supabase.from('expenses').insert({
    description, total_amount: Number(total_amount),
    paid_to: paid_to || null, category_id: category_id || null,
    date: date || new Date().toISOString().slice(0, 10),
    notes: notes || null, created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allocRows = allocations.map((a: { part_id: string; amount: number }) => ({
    expense_id: expense.id, part_id: a.part_id, amount: Number(a.amount),
  }))
  const { error: allocError } = await supabase.from('expense_allocations').insert(allocRows)
  if (allocError) return NextResponse.json({ error: allocError.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'CREATE', entity_type: 'expense', entity_id: expense.id,
    summary: `Added expense "${description}" PKR ${total_amount}`,
    performed_by: user.id,
  })

  return NextResponse.json(expense)
}

export async function PUT(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || profile?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, description, total_amount, paid_to, category_id, date, notes, allocations } = body

  const allocationTotal = allocations.reduce((s: number, a: { amount: number }) => s + Number(a.amount), 0)
  if (Math.abs(allocationTotal - Number(total_amount)) > 0.01)
    return NextResponse.json({ error: 'Allocation amounts must sum to total' }, { status: 400 })

  const { data: before } = await supabase.from('expenses').select('*').eq('id', id).single()
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
    summary: `Updated expense "${description}" PKR ${total_amount}`,
    changes: { before, after: data },
    performed_by: user.id,
  })

  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || profile?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const { data: before } = await supabase.from('expenses').select('*').eq('id', id).single()
  const { error } = await supabase.from('expenses').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'DELETE', entity_type: 'expense', entity_id: id,
    summary: `Deleted expense "${before?.description}" PKR ${before?.total_amount}`,
    changes: { before },
    performed_by: user.id,
  })

  return NextResponse.json({ ok: true })
}
