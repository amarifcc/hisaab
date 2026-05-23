'use client'

import { useMemo } from 'react'
import ShareMeter from '@/components/ShareMeter'
import InfoTooltip from '@/components/InfoTooltip'
import { formatPKR, amountHint } from '@/lib/utils'
import type { ProjectPart, Category, ExpenseWithDetails } from '@/lib/types'

interface Props {
  parts: ProjectPart[]
  categories: Category[]
  expenses: ExpenseWithDetails[]
  title?: string
  subtitle?: string
  /** Owner perspective phrases the split as "you paid"; supervisor as "owner-direct". */
  ownerView?: boolean
}

type CatSlice = { id: string; name: string; color: string; amount: number; owner: number }
type PartSummary = {
  part: ProjectPart
  supervisor: number
  owner: number
  total: number
  categories: CatSlice[]
}

function compactOwner(amount: number) {
  return amountHint(amount) || formatPKR(amount)
}

export default function CombinedReportView({ parts, categories, expenses, title = 'Combined Report', subtitle, ownerView = false }: Props) {
  const summaries = useMemo<PartSummary[]>(() => {
    return parts.map(part => {
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
      return { part, supervisor, owner, total: supervisor + owner, categories: cats }
    })
  }, [parts, categories, expenses])

  const grand = useMemo(() => summaries.reduce(
    (acc, s) => ({ supervisor: acc.supervisor + s.supervisor, owner: acc.owner + s.owner, total: acc.total + s.total }),
    { supervisor: 0, owner: 0, total: 0 }
  ), [summaries])

  const directLabel = ownerView ? 'you paid directly' : 'owner-direct'
  const catOwnerLabel = ownerView ? 'you' : 'owner'

  return (
    <div className="px-4 pt-5 pb-8 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <InfoTooltip
            label="Combined report info"
            text="Total spent on each part — money managed by the supervisor plus what the owner paid directly. The bar shows how that total was funded."
          />
        </div>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* Grand total hero — only meaningful across multiple parts */}
      {parts.length > 1 && (
        <div className="rounded-2xl bg-slate-900 text-white px-4 py-5 shadow-sm">
          <p className="text-xs font-medium opacity-70">Total spent · all parts</p>
          <p className="text-3xl font-bold mt-1">PKR {formatPKR(grand.total)}</p>
          <SplitMeter supervisor={grand.supervisor} owner={grand.owner} light />
          {grand.owner > 0 && (
            <p className="text-[11px] opacity-80 mt-2">
              {directLabel}: <span className="font-semibold">PKR {formatPKR(grand.owner)}</span>
              {grand.total > 0 && <> ({Math.round((grand.owner / grand.total) * 100)}%)</>}
            </p>
          )}
        </div>
      )}

      {/* Per-part cards */}
      <div className="space-y-3">
        {summaries.map(s => {
          const ownerPct = s.total > 0 ? Math.round((s.owner / s.total) * 100) : 0
          return (
            <div key={s.part.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Headline: part + total cost */}
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: s.part.color }}>
                    {s.part.short_name}
                  </span>
                  <span className="text-sm font-semibold text-slate-700 truncate">{s.part.name}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">PKR {formatPKR(s.total)}</p>
                <SplitMeter supervisor={s.supervisor} owner={s.owner} />
                {s.owner > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    of which {directLabel}: <span className="font-semibold text-emerald-600">PKR {formatPKR(s.owner)}</span> ({ownerPct}%)
                  </p>
                )}
              </div>

              {/* Category breakdown */}
              {s.categories.length > 0 ? (
                <div className="border-t border-slate-100 px-4 py-3 space-y-2.5">
                  {s.categories.map(c => (
                    <div key={c.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="text-slate-600 truncate">{c.name}</span>
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          {c.owner > 0 && <span className="text-[11px] text-slate-400">{catOwnerLabel} {compactOwner(c.owner)}</span>}
                          <span className="text-slate-500 font-medium">PKR {formatPKR(c.amount)}</span>
                        </span>
                      </div>
                      <ShareMeter percent={s.total > 0 ? (c.amount / s.total) * 100 : 0} color={c.color} className="" />
                    </div>
                  ))}
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
    </div>
  )
}

// Two-tone funding meter: supervisor (blue) + owner (emerald).
function SplitMeter({ supervisor, owner, light = false }: { supervisor: number; owner: number; light?: boolean }) {
  const total = supervisor + owner
  const supPct = total > 0 ? (supervisor / total) * 100 : 0
  const ownPct = total > 0 ? (owner / total) * 100 : 0
  return (
    <div className={`h-2 rounded-full mt-2 overflow-hidden flex ${light ? 'bg-white/20' : 'bg-slate-100'}`}>
      <div className="h-full bg-blue-500" style={{ width: `${supPct}%` }} />
      <div className="h-full bg-emerald-500" style={{ width: `${ownPct}%` }} />
    </div>
  )
}
