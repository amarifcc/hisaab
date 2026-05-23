import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getSupervisor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return { supabase, user, profile }
}

// List all app users (profiles) with their assigned part. Supervisor only.
export async function GET() {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || (profile as { role?: string } | null)?.role !== 'supervisor')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('profiles')
    .select('id, name, role, part_id, project_parts(id, name, short_name, color)')
    .order('name')
  return NextResponse.json(data ?? [])
}

// Update a user's role + assigned part. Supervisor only.
// role='owner' requires part_id; any other role clears part_id.
export async function PUT(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || (profile as { role?: string } | null)?.role !== 'supervisor')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, role, part_id } = await req.json()
  if (!id || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!['supervisor', 'owner', 'viewer'].includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  if (role === 'owner' && !part_id)
    return NextResponse.json({ error: 'Owners must be assigned a project part' }, { status: 400 })

  // Prevent supervisor from demoting themselves (avoid locking out the last admin).
  if (id === user.id && role !== 'supervisor')
    return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })

  const { data, error } = await supabase
    .from('profiles')
    .update({ role, part_id: role === 'owner' ? part_id : null })
    .eq('id', id)
    .select('id, name, role, part_id, project_parts(id, name, short_name, color)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
