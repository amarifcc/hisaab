import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getSupervisor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return { supabase, user, profile }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  const types = searchParams.get('types')?.split(',').filter(Boolean)

  let query = supabase.from('people').select('*').order('name')
  if (types && types.length > 0) {
    query = query.in('person_type', types)
  } else if (type === 'owner' || type === 'contractor' || type === 'employee' || type === 'supplier') {
    query = query.eq('person_type', type)
  }

  const { data } = await query
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || (profile as any)?.role !== 'supervisor')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, person_type } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('people')
    .insert({ name: name.trim(), person_type: person_type ?? 'contractor' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || (profile as any)?.role !== 'supervisor')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, name, person_type } = await req.json()
  const updates: Record<string, string> = {}
  if (name !== undefined) updates.name = name.trim()
  if (person_type !== undefined) updates.person_type = person_type

  const { data, error } = await supabase.from('people').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || (profile as any)?.role !== 'supervisor')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
