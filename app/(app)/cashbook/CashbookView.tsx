'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, Info } from 'lucide-react'
import { cn, formatPKR } from '@/lib/utils'
import type { ProjectPart, Transfer, Expense, ExpenseAllocation } from '@/lib/types'

type TransferWithPart = Transfer & { project_parts: ProjectPart }
type ExpenseWithAllocations = Expense & {
  expense_allocations: (ExpenseAllocation & { project_parts: ProjectPart })[]
}

interface Props {
  parts: ProjectPart[]
  transfers: TransferWithPart[]
  expenses: ExpenseWithAllocations[]
}

const PART_FILTER_KEY = 'hisab_cashbook_filter_part'
const INITIAL_DAYS = 5
const LOAD_MORE_COUNT = 5

function getPKTToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date())
}

function getPKTTime(): string {
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date())
}

function getYesterday(todayPKT: string): string {
  const d = new Date(todayPKT + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function formatDayHeading(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

type DayData = {
  cashIn: number
  cashOut: number
  opening: number
  closing: number
}

function computeAllDayData(
  transfers: TransferWithPart[],
  expenses: ExpenseWithAllocations[],
  filterPart: string,
  todayPKT: string,
): Record<string, DayData> {
  const dailyCashIn: Record<string, number> = {}
  const dailyCashOut: Record<string, number> = {}

  for (const t of transfers) {
    const amt = (filterPart === 'all' || t.part_id === filterPart) ? Number(t.amount) : 0
    if (amt === 0) continue
    dailyCashIn[t.date] = (dailyCashIn[t.date] ?? 0) + amt
  }

  for (const e of expenses) {
    let amt: number
    if (filterPart === 'all') {
      amt = Number(e.total_amount)
    } else {
      const alloc = e.expense_allocations.find(a => a.part_id === filterPart)
      amt = alloc ? Number(alloc.amount) : 0
    }
    if (amt === 0) continue
    dailyCashOut[e.date] = (dailyCashOut[e.date] ?? 0) + amt
  }

  const activeDates = new Set([
    ...Object.keys(dailyCashIn),
    ...Object.keys(dailyCashOut),
    todayPKT,
  ])

  const sortedDates = [...activeDates].sort()
  const result: Record<string, DayData> = {}
  let running = 0

  for (const date of sortedDates) {
    const cashIn = dailyCashIn[date] ?? 0
    const cashOut = dailyCashOut[date] ?? 0
    result[date] = { cashIn, cashOut, opening: running, closing: running + cashIn - cashOut }
    running += cashIn - cashOut
  }

  return result
}

export default function CashbookView({ parts, transfers, expenses }: Props) {
  const [filterPart, setFilterPart] = useState<string>(() =>
    typeof window === 'undefined' ? 'all' : (localStorage.getItem(PART_FILTER_KEY) || 'all')
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [daysShown, setDaysShown] = useState(INITIAL_DAYS)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [todayPKT] = useState(() => getPKTToday())
  const [currentTime] = useState(() => getPKTTime())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) setTooltipOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function changePartFilter(val: string) {
    setFilterPart(val)
    localStorage.setItem(PART_FILTER_KEY, val)
    setDropdownOpen(false)
    setDaysShown(INITIAL_DAYS)
    setExpandedDates(new Set())
  }

  function toggleExpanded(date: string) {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const dayDataMap = useMemo(
    () => computeAllDayData(transfers, expenses, filterPart, todayPKT),
    [transfers, expenses, filterPart, todayPKT]
  )

  const allDates = useMemo(
    () => Object.keys(dayDataMap).sort().reverse(),
    [dayDataMap]
  )

  const visibleDates = allDates.slice(0, daysShown)
  const hasMore = daysShown < allDates.length
  const selectedPart = parts.find(p => p.id === filterPart)
  const yesterdayPKT = getYesterday(todayPKT)

  function getDayTransfers(date: string): TransferWithPart[] {
    return transfers.filter(t =>
      t.date === date && (filterPart === 'all' || t.part_id === filterPart)
    )
  }

  function getDayExpenses(date: string): { expense: ExpenseWithAllocations; amount: number }[] {
    return expenses
      .filter(e => e.date === date)
      .flatMap(e => {
        if (filterPart === 'all') {
          return Number(e.total_amount) > 0 ? [{ expense: e, amount: Number(e.total_amount) }] : []
        }
        const alloc = e.expense_allocations.find(a => a.part_id === filterPart)
        return alloc && Number(alloc.amount) > 0 ? [{ expense: e, amount: Number(alloc.amount) }] : []
      })
  }

  return (
    <div className="px-4 pt-5 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">Cashbook</h1>
          <div className="relative" ref={tooltipRef}>
            <button
              onClick={() => setTooltipOpen(o => !o)}
              className="text-slate-300 active:text-slate-500"
              aria-label="Cashbook info"
            >
              <Info size={15} />
            </button>
            {tooltipOpen && (
              <div className="absolute top-full left-0 mt-1.5 bg-slate-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-lg z-30 w-64 leading-relaxed">
                Shows daily opening balance, cash received, cash spent, and closing balance. Tap a card to see individual transactions.
                {filterPart !== 'all' && (
                  <span className="block mt-1 text-slate-400">
                    Filtered view shows net position for this part only. Switch to &quot;All Parts&quot; for full cash position.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Part filter */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
          >
            {selectedPart && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedPart.color }} />}
            {selectedPart ? selectedPart.name : 'All Parts'}
            <ChevronDown size={13} className={cn('transition-transform', dropdownOpen && 'rotate-180')} />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full right-0 mt-1.5 bg-white rounded-2xl border border-slate-100 shadow-lg z-30 min-w-[160px] overflow-hidden">
              <button
                onClick={() => changePartFilter('all')}
                className={cn('w-full text-left px-4 py-3 text-sm font-medium transition-colors',
                  filterPart === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')}
              >
                All Parts
              </button>
              {parts.map(p => (
                <button
                  key={p.id}
                  onClick={() => changePartFilter(p.id)}
                  className={cn('w-full text-left px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors',
                    filterPart === p.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50')}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Day cards */}
      <div className="space-y-3">
        {visibleDates.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-12">No transactions recorded yet</p>
        )}

        {visibleDates.map(date => {
          const data = dayDataMap[date]
          const isToday = date === todayPKT
          const isYesterday = date === yesterdayPKT
          const label = formatDayHeading(date)
          const net = data.cashIn - data.cashOut
          const isExpanded = expandedDates.has(date)
          const hasActivity = data.cashIn > 0 || data.cashOut > 0

          return (
            <div key={date} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

              {/* Day header */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{label}</span>
                  {isToday && (
                    <span className="text-[11px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Today</span>
                  )}
                  {isYesterday && (
                    <span className="text-[11px] font-semibold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">Yesterday</span>
                  )}
                </div>
                {isToday && (
                  <span className="text-[11px] text-slate-400">till {currentTime} PKT</span>
                )}
              </div>

              {/* Opening balance */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-50">
                <span className="text-xs text-slate-400">Opening Balance</span>
                <span className="text-sm font-medium text-slate-600">
                  {data.opening < 0 ? '−' : ''}PKR {formatPKR(Math.abs(data.opening))}
                </span>
              </div>

              {/* Cash In */}
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <ArrowDownToLine size={12} className="text-emerald-600" />
                  </div>
                  <span className="text-xs text-slate-500">Cash In</span>
                </div>
                <span className={cn('text-sm font-semibold', data.cashIn > 0 ? 'text-emerald-600' : 'text-slate-300')}>
                  {data.cashIn > 0 ? `+ PKR ${formatPKR(data.cashIn)}` : '—'}
                </span>
              </div>

              {/* Cash Out */}
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                    <ArrowUpFromLine size={12} className="text-rose-500" />
                  </div>
                  <span className="text-xs text-slate-500">Cash Out</span>
                </div>
                <span className={cn('text-sm font-semibold', data.cashOut > 0 ? 'text-rose-500' : 'text-slate-300')}>
                  {data.cashOut > 0 ? `− PKR ${formatPKR(data.cashOut)}` : '—'}
                </span>
              </div>

              {/* Closing balance — also acts as expand toggle */}
              <button
                className="w-full px-4 py-3 flex items-center justify-between active:bg-slate-50 transition-colors"
                onClick={() => hasActivity && toggleExpanded(date)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    {isToday ? 'Current Balance' : 'Closing Balance'}
                  </span>
                  {net !== 0 && (
                    <span className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                      net > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                    )}>
                      {net > 0 ? `+${formatPKR(net)}` : `−${formatPKR(Math.abs(net))}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-base font-bold', data.closing < 0 ? 'text-red-500' : 'text-emerald-600')}>
                    {data.closing < 0 ? '−' : ''}PKR {formatPKR(Math.abs(data.closing))}
                  </span>
                  {hasActivity && (
                    <ChevronDown
                      size={14}
                      className={cn('text-slate-300 flex-shrink-0 transition-transform', isExpanded && 'rotate-180')}
                    />
                  )}
                </div>
              </button>

              {/* Expanded detail rows */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {/* Transfers (Cash In) */}
                  {getDayTransfers(date).map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">
                            {t.from_person || 'Transfer received'}
                          </p>
                          {filterPart === 'all' && t.project_parts && (
                            <span
                              className="text-[10px] font-medium px-1 py-0.5 rounded text-white"
                              style={{ backgroundColor: t.project_parts.color }}
                            >
                              {t.project_parts.short_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 flex-shrink-0 ml-3">
                        + PKR {formatPKR(Number(t.amount))}
                      </span>
                    </div>
                  ))}

                  {/* Expenses (Cash Out) */}
                  {getDayExpenses(date).map(({ expense: e, amount }) => (
                    <div key={e.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">
                            {e.description || e.paid_to || 'Expense'}
                          </p>
                          {e.paid_to && e.description && (
                            <p className="text-[10px] text-slate-400 truncate">{e.paid_to}</p>
                          )}
                          {filterPart === 'all' && e.expense_allocations.length > 1 && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {e.expense_allocations.map(a => (
                                <span
                                  key={a.part_id}
                                  className="text-[10px] font-medium px-1 py-0.5 rounded text-white"
                                  style={{ backgroundColor: a.project_parts?.color }}
                                >
                                  {a.project_parts?.short_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-rose-500 flex-shrink-0 ml-3">
                        − PKR {formatPKR(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Load more */}
        {hasMore && (
          <button
            onClick={() => setDaysShown(n => n + LOAD_MORE_COUNT)}
            className="w-full py-3 text-sm font-medium text-slate-500 bg-white border border-slate-200 rounded-2xl active:bg-slate-50 transition-colors"
          >
            Load {Math.min(LOAD_MORE_COUNT, allDates.length - daysShown)} more days
          </button>
        )}

        {!hasMore && allDates.length > INITIAL_DAYS && (
          <p className="text-center text-xs text-slate-300 pt-1">All history shown</p>
        )}

        <p className="text-center text-xs text-slate-300 pt-1">Hisaab · {new Date().toLocaleDateString('en-PK')}</p>
      </div>
    </div>
  )
}
