'use client'

import { useState, useRef } from 'react'
import { formatPKR, formatDate, cn } from '@/lib/utils'
import { Share2, ChevronDown, ArrowDownLeft, TrendingDown } from 'lucide-react'
import type { ProjectPart, Category, Transfer, Expense, ExpenseAllocation } from '@/lib/types'

type TransferWithPart = Transfer & { project_parts: ProjectPart }
type ExpenseWithDetails = Expense & {
  categories: Category | null
  expense_allocations: (ExpenseAllocation & { project_parts: ProjectPart })[]
}

interface Props {
  parts: ProjectPart[]
  transfers: TransferWithPart[]
  expenses: ExpenseWithDetails[]
  categories: Category[]
}

const PART_FILTER_KEY = 'hisab_reports_filter_part'

export default function ReportsView({ parts, transfers, expenses, categories }: Props) {
  const [filterPart, setFilterPart] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(PART_FILTER_KEY) ?? 'all'
    return 'all'
  })
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  function changePartFilter(val: string) {
    setFilterPart(val)
    localStorage.setItem(PART_FILTER_KEY, val)
    setDropdownOpen(false)
  }

  function filterByDate<T extends { date: string }>(items: T[]): T[] {
    return items.filter(i => {
      if (fromDate && i.date < fromDate) return false
      if (toDate && i.date > toDate) return false
      return true
    })
  }

  const filteredTransfers = filterByDate(transfers).filter(t =>
    filterPart === 'all' || t.part_id === filterPart
  )
  const filteredExpenses = filterByDate(expenses).filter(e =>
    filterPart === 'all' || e.expense_allocations.some(a => a.part_id === filterPart)
  )

  function getExpenseAmount(e: ExpenseWithDetails): number {
    if (filterPart === 'all') return e.total_amount
    return e.expense_allocations.find(a => a.part_id === filterPart)?.amount ?? 0
  }

  const totalIn = filteredTransfers.reduce((s, t) => s + t.amount, 0)
  const totalOut = filteredExpenses.reduce((s, e) => s + getExpenseAmount(e), 0)
  const balance = totalIn - totalOut

  const catBreakdown = categories.map(c => ({
    cat: c,
    total: filteredExpenses.filter(e => e.category_id === c.id).reduce((s, e) => s + getExpenseAmount(e), 0),
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  const partSummaries = parts.map(p => {
    const deposited = filterByDate(transfers).filter(t => t.part_id === p.id).reduce((s, t) => s + t.amount, 0)
    const spent = filterByDate(expenses).reduce((s, e) => {
      const alloc = e.expense_allocations.find(a => a.part_id === p.id)
      return s + (alloc?.amount ?? 0)
    }, 0)
    return { part: p, deposited, spent, balance: deposited - spent }
  })

  const selectedPart = parts.find(p => p.id === filterPart)

  async function captureCanvas() {
    const { default: html2canvas } = await import('html2canvas')
    if (!reportRef.current) return null
    return html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
  }

  async function handleShare() {
    setExporting(true)
    try {
      const canvas = await captureCanvas()
      if (!canvas) return

      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'hisaab-report.png', { type: 'image/png' })

        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Hisaab Report' })
        } else {
          // Fallback: direct download
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'hisaab-report.png'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      }, 'image/png')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportPDF() {
    setExporting(true)
    try {
      const canvas = await captureCanvas()
      if (!canvas) return
      const { default: jsPDF } = await import('jspdf')
      const w = canvas.width / 2
      const h = canvas.height / 2
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [w, h] })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h)
      pdf.save('hisaab-report.pdf')
    } finally {
      setExporting(false)
    }
  }

  const transactions = [
    ...filteredTransfers.map(t => ({ date: t.date, type: 'in' as const, item: t })),
    ...filteredExpenses.map(e => ({ date: e.date, type: 'out' as const, item: e })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="px-4 pt-5 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>

        <div className="flex items-center gap-2">
          {/* Part dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              {selectedPart && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedPart.color }} />}
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

          {/* Share / export */}
          <button
            onClick={handleShare}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            <Share2 size={14} />
            {exporting ? 'Exporting…' : 'Share'}
          </button>
        </div>
      </div>

      {/* Date filters */}
      <div className="flex gap-2 mb-5">
        <div className="flex-1">
          <label className="text-xs text-slate-400 block mb-1">From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-400 block mb-1">To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(fromDate || toDate) && (
          <div className="flex items-end pb-0.5">
            <button onClick={() => { setFromDate(''); setToDate('') }}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-500">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ── Exportable report area ── */}
      <div ref={reportRef} className="space-y-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">

        {/* Report title */}
        <div className="mb-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {selectedPart ? selectedPart.name : 'All Parts'}
            {(fromDate || toDate) && ` · ${fromDate || '…'} → ${toDate || '…'}`}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-600 font-medium mb-0.5">In</p>
            <p className="text-sm font-bold text-emerald-700">PKR {formatPKR(totalIn)}</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-3 text-center">
            <p className="text-xs text-rose-500 font-medium mb-0.5">Out</p>
            <p className="text-sm font-bold text-rose-600">PKR {formatPKR(totalOut)}</p>
          </div>
          <div className={cn('rounded-xl p-3 text-center', balance >= 0 ? 'bg-blue-50' : 'bg-red-50')}>
            <p className={cn('text-xs font-medium mb-0.5', balance >= 0 ? 'text-blue-600' : 'text-red-500')}>Balance</p>
            <p className={cn('text-sm font-bold', balance >= 0 ? 'text-blue-700' : 'text-red-600')}>PKR {formatPKR(balance)}</p>
          </div>
        </div>

        {/* Per-part breakdown (combined view only) */}
        {filterPart === 'all' && partSummaries.length > 0 && (
          <div className="bg-slate-50 rounded-xl overflow-hidden">
            <p className="text-xs font-semibold text-slate-400 px-4 pt-3 pb-2 uppercase tracking-wide">By Floor</p>
            {partSummaries.map(({ part, deposited, spent, balance: b }) => (
              <div key={part.id} className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: part.color }} />
                  <span className="text-sm font-medium text-slate-800">{part.name}</span>
                </div>
                <div className="text-right">
                  <p className={cn('text-sm font-bold', b >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {b < 0 ? '−' : ''}PKR {formatPKR(Math.abs(b))}
                  </p>
                  <p className="text-xs text-slate-400">{formatPKR(deposited)} in · {formatPKR(spent)} out</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Category breakdown */}
        {catBreakdown.length > 0 && (
          <div className="bg-slate-50 rounded-xl overflow-hidden">
            <p className="text-xs font-semibold text-slate-400 px-4 pt-3 pb-2 uppercase tracking-wide">By Category</p>
            {catBreakdown.map(({ cat, total }) => {
              const pct = totalOut > 0 ? (total / totalOut) * 100 : 0
              return (
                <div key={cat.id} className="px-4 py-2.5 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm text-slate-700">{cat.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">PKR {formatPKR(total)}</span>
                  </div>
                  <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Transaction log */}
        <div className="bg-slate-50 rounded-xl overflow-hidden">
          <p className="text-xs font-semibold text-slate-400 px-4 pt-3 pb-2 uppercase tracking-wide">
            Transactions ({transactions.length})
          </p>
          {transactions.length === 0 && (
            <p className="text-center text-slate-400 text-xs py-4">No transactions</p>
          )}
          {transactions.map(({ type, item }) => (
            <div key={item.id} className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
              {type === 'in' ? (
                <>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <ArrowDownLeft size={12} className="text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {(item as TransferWithPart).project_parts?.short_name}
                        {(item as TransferWithPart).from_person ? ` · ${(item as TransferWithPart).from_person}` : ''}
                      </p>
                      <p className="text-xs text-slate-400">{formatDate(item.date)}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 flex-shrink-0">+{formatPKR((item as Transfer).amount)}</span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                      <TrendingDown size={12} className="text-rose-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {(item as ExpenseWithDetails).description || (item as ExpenseWithDetails).categories?.name || 'Expense'}
                      </p>
                      <p className="text-xs text-slate-400">{formatDate(item.date)}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-rose-500 flex-shrink-0">-{formatPKR(getExpenseAmount(item as ExpenseWithDetails))}</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer watermark */}
        <p className="text-center text-xs text-slate-300 pt-1">Hisaab · {new Date().toLocaleDateString('en-PK')}</p>
      </div>

      {/* PDF export (secondary) */}
      <button
        onClick={handleExportPDF}
        disabled={exporting}
        className="mt-3 w-full py-2.5 border border-slate-200 rounded-xl text-sm text-slate-500 font-medium disabled:opacity-50"
      >
        {exporting ? 'Exporting…' : 'Export as PDF'}
      </button>
    </div>
  )
}
