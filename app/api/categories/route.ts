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

  const { name, color } = await req.json()
  const { data, error } = await supabase.from('categories').insert({ name, color: color || '#6366f1' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_logs').insert({
    action: 'CREATE', entity_type: 'category', entity_id: data.id,
    summary: `Added category "${name}"`, performed_by: user.id,
  })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || profile?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, name, color } = await req.json()
  const { data, error } = await supabase.from('categories').update({ name, color }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || profile?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()

  // Check if any expenses use this category
  const { count } = await supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('category_id', id)
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'Category has linked expenses', linkedCount: count }, { status: 409 })

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
