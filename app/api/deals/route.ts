import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DEAL_SELECT = '*, project_parts(*), deal_revisions(*)'
type ProfileRole = { role?: string } | null

async function getSupervisor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return { supabase, user, profile }
}

function isSupervisor(profile: ProfileRole) {
  return profile?.role === 'supervisor'
}

async function getDealTotal(supabase: Awaited<ReturnType<typeof createClient>>, dealId: string, fallback = 0) {
  const { data } = await supabase.from('deal_revisions').select('amount_delta').eq('deal_id', dealId)
  if (!data?.length) return fallback
  return data.reduce((sum, revision) => sum + Number(revision.amount_delta), 0)
}

async function selectDeal(supabase: Awaited<ReturnType<typeof createClient>>, dealId: string) {
  const { data, error } = await supabase.from('deals').select(DEAL_SELECT).eq('id', dealId).single()
  if (!error) return data

  const { data: fallback } = await supabase.from('deals').select('*, project_parts(*)').eq('id', dealId).single()
  return fallback
}

export async function POST(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || !isSupervisor(profile))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, person_name, part_id, agreed_amount, date, notes } = await req.json()
  if (!name?.trim() || !part_id || !agreed_amount)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: deal, error } = await supabase.from('deals').insert({
    name: name.trim(),
    person_name: person_name?.trim() || null,
    part_id,
    agreed_amount: Number(agreed_amount),
    date: date || new Date().toISOString().slice(0, 10),
    notes: notes || null,
    created_by: user.id,
  }).select('*, project_parts(*)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: revisionError } = await supabase.from('deal_revisions').insert({
    deal_id: deal.id,
    revision_number: 1,
    scope_description: name.trim(),
    amount_delta: Number(agreed_amount),
    date: date || new Date().toISOString().slice(0, 10),
    notes: notes || null,
    created_by: user.id,
  })

  if (revisionError) {
    await supabase.from('deals').delete().eq('id', deal.id)
    return NextResponse.json({ error: revisionError.message }, { status: 500 })
  }

  const data = await selectDeal(supabase, deal.id)

  await supabase.from('activity_logs').insert({
    action: 'CREATE', entity_type: 'deal', entity_id: deal.id,
    summary: `Added deal "${name}" PKR ${agreed_amount}${person_name ? ` with ${person_name}` : ''}`,
    performed_by: user.id,
  })

  return NextResponse.json(data ?? deal)
}

export async function PUT(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || !isSupervisor(profile))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, name, person_name, part_id, date, notes } = await req.json()
  if (!id || !name?.trim() || !part_id)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: before } = await supabase.from('deals').select('*').eq('id', id).single()
  const update: {
    name: string
    person_name: string | null
    part_id: string
    date?: string
    notes?: string | null
    updated_at: string
  } = {
    name: name.trim(),
    person_name: person_name?.trim() || null,
    part_id,
    updated_at: new Date().toISOString(),
  }
  if (date) update.date = date
  if (notes !== undefined) update.notes = notes || null

  const { data, error } = await supabase.from('deals').update(update).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const enriched = await selectDeal(supabase, id)

  await supabase.from('activity_logs').insert({
    action: 'UPDATE', entity_type: 'deal', entity_id: id,
    summary: `Updated deal "${name}"`,
    changes: { before, after: enriched ?? data },
    performed_by: user.id,
  })

  return NextResponse.json(enriched ?? data)
}

export async function PATCH(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || !isSupervisor(profile))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, revision_id, scope_description, amount_delta, date, notes } = await req.json()
  const delta = Number(amount_delta)
  if (!id || !scope_description?.trim() || !delta)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: deal, error: dealError } = await supabase.from('deals').select('*').eq('id', id).single()
  if (dealError || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  if (revision_id) {
    const { data: before, error: revisionError } = await supabase
      .from('deal_revisions')
      .select('*')
      .eq('id', revision_id)
      .eq('deal_id', id)
      .single()

    if (revisionError || !before) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })

    const currentTotal = await getDealTotal(supabase, id, Number(deal.agreed_amount))
    const nextTotal = currentTotal - Number(before.amount_delta) + delta
    if (nextTotal < 0)
      return NextResponse.json({ error: 'Revision would make agreed total negative' }, { status: 400 })

    const { data: revision, error } = await supabase.from('deal_revisions').update({
      scope_description: scope_description.trim(),
      amount_delta: delta,
      date: date || before.date,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', revision_id).eq('deal_id', id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('deals').update({
      agreed_amount: nextTotal,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    await supabase.from('activity_logs').insert({
      action: 'UPDATE', entity_type: 'deal_revision', entity_id: revision.id,
      summary: `Updated V${revision.revision_number} for "${deal.name}"`,
      changes: { before, after: revision },
      performed_by: user.id,
    })

    const data = await selectDeal(supabase, id)
    return NextResponse.json(data ?? { ...deal, deal_revisions: [revision] })
  }

  const currentTotal = await getDealTotal(supabase, id, Number(deal.agreed_amount))
  if (currentTotal + delta < 0)
    return NextResponse.json({ error: 'Revision would make agreed total negative' }, { status: 400 })

  const { data: revisions } = await supabase
    .from('deal_revisions')
    .select('revision_number')
    .eq('deal_id', id)

  const revisionNumber = (revisions ?? []).reduce((max, revision) => Math.max(max, Number(revision.revision_number)), 0) + 1
  const revisionDate = date || new Date().toISOString().slice(0, 10)
  const { data: revision, error } = await supabase.from('deal_revisions').insert({
    deal_id: id,
    revision_number: revisionNumber,
    scope_description: scope_description.trim(),
    amount_delta: delta,
    date: revisionDate,
    notes: notes || null,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('deals').update({
    agreed_amount: currentTotal + delta,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  await supabase.from('activity_logs').insert({
    action: 'CREATE', entity_type: 'deal_revision', entity_id: revision.id,
    summary: `Added scope to "${deal.name}" ${delta > 0 ? '+' : ''}PKR ${delta}`,
    changes: { after: revision },
    performed_by: user.id,
  })

  const data = await selectDeal(supabase, id)
  return NextResponse.json(data ?? { ...deal, deal_revisions: [revision] })
}

export async function DELETE(req: Request) {
  const { supabase, user, profile } = await getSupervisor()
  if (!user || !isSupervisor(profile))
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
