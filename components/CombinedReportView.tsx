'use client'

import { useMemo } from 'react'
import { formatPKR } from '@/lib/utils'
import type { ProjectPart, Category, ExpenseWithDetails } from '@/lib/types'

interface Props {
  parts: ProjectPart[]
  categories: Category[]
  expenses: ExpenseWithDetails[]
  title?: string
  subtitle?: string
}

type CatSlice = { id: string; name: string; color: string; amount: number }
type PartSummary = {
  part: ProjectPart
  supervisor: number
  owner: number
  total: number
  categories: CatSlice[]
}

export default function CombinedReportView({ parts, categories, expenses, title = 'Combined Report', subtitle }: Props) {
  const summaries = useMemo<PartSummary[]>(() => {
    return parts.map(part => {
      let supervisor = 0
      let owner = 0
      const catMap = new Map<string, number>()

      for (const e of expenses) {
        const allocs = e.expense_allocations ?? []
        const partAmount = allocs
          .filter(a => a.part_id === part.id)
          .reduce((s, a) => s + Number(a.amount), 0)
        if (partAmount === 0) continue

        if (e.source === 'owner') owner += partAmount
        else supervisor += partAmount

        const catId = e.category_id ?? '__none__'
        catMap.set(catId, (catMap.get(catId) ?? 0) + partAmount)
      }

      const cats: CatSlice[] = [...catMap.entries()]
        .map(([id, amount]) => {
          const c = categories.find(x => x.id === id)
          return { id, name: c?.name ?? 'Uncategorized', color: c?.color ?? '#94a3b8', amount }
        })
        .sort((a, b) => b.amount - a.amount)

      return { part, supervisor, owner, total: supervisor + owner, categories: cats }
    })
  }, [parts, categories, expenses])

  const grand = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({ supervisor: acc.supervisor + s.supervisor, owner: acc.owner + s.owner, total: acc.total + s.total }),
      { supervisor: 0, owner: 0, total: 0 }
    )
  }, [summaries])

  return (
    <div className="px-4 pt-5 pb-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* Grand total (only meaningful across multiple parts) */}
      {parts.length > 1 && (
        <div className="rounded-2xl bg-slate-900 text-white px-4 py-5">
          <p className="text-xs font-medium opacity-70">Total spent · all parts</p>
          <p className="text-2xl font-bold mt-1">PKR {formatPKR(grand.total)}</p>
          <SplitBar supervisor={grand.supervisor} owner={grand.owner} light />
        </div>
      )}

      {/* Per-part cards */}
      <div className="space-y-3">
        {summaries.map(s => (
          <div key={s.part.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: s.part.color }}>
                    {s.part.short_name}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 truncate">{s.part.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900 flex-shrink-0">PKR {formatPKR(s.total)}</span>
              </div>
              <SplitBar supervisor={s.supervisor} owner={s.owner} />
              <div className="flex gap-4 mt-2 text-[11px]">
                <span className="text-slate-400">
                  Supervisor <span className="font-semibold text-blue-600">PKR {formatPKR(s.supervisor)}</span>
                </span>
                <span className="text-slate-400">
                  Owner <span className="font-semibold text-emerald-600">PKR {formatPKR(s.owner)}</span>
                </span>
              </div>
            </div>

            {/* Category breakdown */}
            {s.categories.length > 0 ? (
              <div className="px-4 py-3 space-y-2">
                {s.categories.map(c => {
                  const pct = s.total > 0 ? (c.amount / s.total) * 100 : 0
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="text-slate-600 truncate">{c.name}</span>
                        </span>
                        <span className="text-slate-500 font-medium flex-shrink-0">PKR {formatPKR(c.amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-4 py-4 text-center">
                <p className="text-xs text-slate-400">No spend recorded for this part yet.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SplitBar({ supervisor, owner, light = false }: { supervisor: number; owner: number; light?: boolean }) {
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
