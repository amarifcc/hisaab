'use client'

import { useMemo } from 'react'
import ShareMeter from '@/components/ShareMeter'
import InfoTooltip from '@/components/InfoTooltip'
import { formatPKR, amountHint, cn } from '@/lib/utils'
import type { ProjectPart, Category, ExpenseWithDetails } from '@/lib/types'

interface Props {
  parts: ProjectPart[]
  categories: Category[]
  expenses: ExpenseWithDetails[]
  transfers: { part_id: string; amount: number }[]
  title?: string
  subtitle?: string
  /** Owner perspective phrases the split as "you paid"; supervisor as "owner-direct". */
  ownerView?: boolean
}

type CatSlice = { id: string; name: string; color: string; amount: number; owner: number }
type PartSummary = {
  part: ProjectPart
  received: number      // transfers in (owner → supervisor) for this part
  supervisor: number    // supervisor-source spend on this part
  owner: number         // owner-direct spend on this part
  total: number         // supervisor + owner = true cost
  balance: number       // received − supervisor spend (cash still with supervisor)
  categories: CatSlice[]
}

function compact(amount: number) {
  return amountHint(amount) || formatPKR(amount)
}

export default function CombinedReportView({ parts, categories, expenses, transfers, title = 'Combined Report', subtitle, ownerView = false }: Props) {
  const summaries = useMemo<PartSummary[]>(() => {
    return parts.map(part => {
      const received = transfers.filter(t => t.part_id === part.id).reduce((s, t) => s + Number(t.amount), 0)
      let supervisor = 0
      let owner = 0
      const catMap = new Map<string, CatSlice>()

      for (const e of expenses) {
        const partAmount = (e.expense_allocations ?? [])
          .filter(a => a.part_id === part.id)
          .reduce((s, a) => s + Number(a.amount), 0)
        if (partAmount === 0) continue

        const isOwner = e.source === 'owner'
        if (isOwner) owner += partAmount
        else supervisor += partAmount

        const id = e.category_id ?? '__none__'
        const slice = catMap.get(id) ?? {
          id,
          name: categories.find(c => c.id === id)?.name ?? 'Uncategorized',
          color: categories.find(c => c.id === id)?.color ?? '#94a3b8',
          amount: 0,
          owner: 0,
        }
        slice.amount += partAmount
        if (isOwner) slice.owner += partAmount
        catMap.set(id, slice)
      }

      const cats = [...catMap.values()].sort((a, b) => b.amount - a.amount)
      return {
        part,
        received,
        supervisor,
        owner,
        total: supervisor + owner,
        balance: received - supervisor,
        categories: cats,
      }
    })
  }, [parts, categories, expenses, transfers])

  const grand = useMemo(() => summaries.reduce(
    (a, s) => ({
      received: a.received + s.received,
      supervisor: a.supervisor + s.supervisor,
      owner: a.owner + s.owner,
      total: a.total + s.total,
      balance: a.balance + s.balance,
    }),
    { received: 0, supervisor: 0, owner: 0, total: 0, balance: 0 }
  ), [summaries])

  // Project-wide category rollup (supervisor multi-part view).
  const projectCats = useMemo<CatSlice[]>(() => {
    const map = new Map<string, CatSlice>()
    for (const s of summaries) {
      for (const c of s.categories) {
        const cur = map.get(c.id) ?? { id: c.id, name: c.name, color: c.color, amount: 0, owner: 0 }
        cur.amount += c.amount
        cur.owner += c.owner
        map.set(c.id, cur)
      }
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount)
  }, [summaries])

  const directVerb = ownerView ? 'you paid' : 'paid directly'
  const catOwnerLabel = ownerView ? 'you' : 'owner'
  const receivedLabel = ownerView ? 'You gave supervisor' : 'Received'
  const balanceLabel = ownerView ? 'Unspent with supervisor' : 'Balance with supervisor'

  const isMulti = parts.length > 1
  const single = !ownerView ? null : summaries[0]

  return (
    <div className="px-4 pt-5 pb-8 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <InfoTooltip
            label="Combined report info"
            text="The true cost of each part — money the supervisor spent plus what the owner paid directly — alongside how it was funded (transfers in) and what's still unspent."
          />
        </div>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* ── Owner single-part view ─────────────────────────────────── */}
      {single ? (
        <>
          {/* Hero: total cost of their part */}
          <div className="rounded-2xl px-4 py-5 text-white shadow-sm" style={{ backgroundColor: single.part.color }}>
            <p className="text-xs font-medium opacity-80">Total cost · {single.part.name}</p>
            <p className="text-3xl font-bold mt-1">PKR {formatPKR(single.total)}</p>
            {single.owner > 0 && (
              <p className="text-[11px] opacity-90 mt-2">
                via supervisor <span className="font-semibold">PKR {formatPKR(single.supervisor)}</span>
                {' · '}you paid <span className="font-semibold">PKR {formatPKR(single.owner)}</span>
              </p>
            )}
          </div>

          {/* Your money picture */}
          <section>
            <p className="text-sm font-semibold text-slate-700 mb-2">Your money</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Your total contribution</span>
                <span className="text-sm font-bold text-slate-900">PKR {formatPKR(single.received + single.owner)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label={receivedLabel} value={single.received} />
                <Stat label={balanceLabel} value={single.balance} danger={single.balance < 0} />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                You gave the supervisor PKR {formatPKR(single.received)} (transfers){single.owner > 0 && <> and paid PKR {formatPKR(single.owner)} directly</>}. The supervisor has spent PKR {formatPKR(single.supervisor)} of it.
              </p>
            </div>
          </section>

          <CategorySection cats={single.categories} total={single.total} catOwnerLabel={catOwnerLabel} heading="Where it went" />
        </>
      ) : (
        <>
          {/* ── Supervisor view ──────────────────────────────────────── */}
          {isMulti && (
            <div className="rounded-2xl bg-slate-900 text-white px-4 py-5 shadow-sm">
              <p className="text-xs font-medium opacity-70">Total cost · all parts</p>
              <p className="text-3xl font-bold mt-1">PKR {formatPKR(grand.total)}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] opacity-90">
                <span>Received <span className="font-semibold">PKR {formatPKR(grand.received)}</span></span>
                <span>Balance <span className="font-semibold">PKR {formatPKR(grand.balance)}</span></span>
                {grand.owner > 0 && (
                  <span className="text-emerald-300">Owner-direct <span className="font-semibold">PKR {formatPKR(grand.owner)}</span></span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {summaries.map(s => {
              const ownerPct = s.total > 0 ? Math.round((s.owner / s.total) * 100) : 0
              return (
                <div key={s.part.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: s.part.color }}>
                        {s.part.short_name}
                      </span>
                      <span className="text-sm font-semibold text-slate-700 truncate">{s.part.name}</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">PKR {formatPKR(s.total)}</p>

                    {/* Funding split — only when there's owner-direct spend */}
                    {s.owner > 0 && (
                      <>
                        <SplitMeter supervisor={s.supervisor} owner={s.owner} />
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          via supervisor <span className="font-semibold text-slate-600">PKR {formatPKR(s.supervisor)}</span>
                          {' · '}{directVerb} <span className="font-semibold text-emerald-600">PKR {formatPKR(s.owner)}</span> ({ownerPct}%)
                        </p>
                      </>
                    )}

                    {/* Money picture */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Stat label={receivedLabel} value={s.received} />
                      <Stat label={balanceLabel} value={s.balance} danger={s.balance < 0} />
                    </div>
                  </div>

                  {s.categories.length > 0 ? (
                    <div className="border-t border-slate-100 px-4 py-3 space-y-2.5">
                      <CategoryRows cats={s.categories} total={s.total} catOwnerLabel={catOwnerLabel} />
                    </div>
                  ) : (
                    <div className="border-t border-slate-100 px-4 py-4 text-center">
                      <p className="text-xs text-slate-400">No spend recorded for this part yet.</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Project-wide category rollup */}
          {isMulti && projectCats.length > 0 && (
            <CategorySection cats={projectCats} total={grand.total} catOwnerLabel={catOwnerLabel} heading="By category · all parts" />
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cn('text-sm font-bold mt-0.5', danger ? 'text-red-500' : 'text-slate-800')}>
        {value < 0 ? '−' : ''}PKR {formatPKR(Math.abs(value))}
      </p>
    </div>
  )
}

function CategorySection({ cats, total, catOwnerLabel, heading }: { cats: CatSlice[]; total: number; catOwnerLabel: string; heading: string }) {
  if (cats.length === 0) return null
  return (
    <section>
      <p className="text-sm font-semibold text-slate-700 mb-2">{heading}</p>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 space-y-2.5">
        <CategoryRows cats={cats} total={total} catOwnerLabel={catOwnerLabel} />
      </div>
    </section>
  )
}

function CategoryRows({ cats, total, catOwnerLabel }: { cats: CatSlice[]; total: number; catOwnerLabel: string }) {
  return (
    <>
      {cats.map(c => (
        <div key={c.id}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-slate-600 truncate">{c.name}</span>
            </span>
            <span className="flex items-center gap-2 flex-shrink-0">
              {c.owner > 0 && <span className="text-[11px] text-slate-400">{catOwnerLabel} {compact(c.owner)}</span>}
              <span className="text-slate-500 font-medium">PKR {formatPKR(c.amount)}</span>
            </span>
          </div>
          <ShareMeter percent={total > 0 ? (c.amount / total) * 100 : 0} color={c.color} className="" />
        </div>
      ))}
    </>
  )
}

// Two-tone funding meter: supervisor (blue) + owner (emerald).
function SplitMeter({ supervisor, owner }: { supervisor: number; owner: number }) {
  const total = supervisor + owner
  const supPct = total > 0 ? (supervisor / total) * 100 : 0
  const ownPct = total > 0 ? (owner / total) * 100 : 0
  return (
    <div className="h-2 rounded-full mt-2 overflow-hidden flex bg-slate-100">
      <div className="h-full bg-blue-500" style={{ width: `${supPct}%` }} />
      <div className="h-full bg-emerald-500" style={{ width: `${ownPct}%` }} />
    </div>
  )
}
