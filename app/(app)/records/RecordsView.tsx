'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeftRight, Handshake } from 'lucide-react'
import { cn } from '@/lib/utils'
import TransactionsView from '@/app/(app)/transactions/TransactionsView'
import DealsList from '@/app/(app)/deals/DealsList'
import type { DealWithPart, ProjectPart } from '@/lib/types'

type RecordsTab = 'transactions' | 'deals'

interface Props {
  parts: ProjectPart[]
  transfers: Record<string, unknown>[]
  expenses: Record<string, unknown>[]
  deals: DealWithPart[]
  paidMap: Record<string, Record<string, number>>
  isSupervisor: boolean
}

export default function RecordsView({ parts, transfers, expenses, deals, paidMap, isSupervisor }: Props) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'deals' ? 'deals' : 'transactions'
  const [tab, setTab] = useState<RecordsTab>(initialTab)

  useEffect(() => {
    setTab(searchParams.get('tab') === 'deals' ? 'deals' : 'transactions')
  }, [searchParams])

  const tabs = [
    { id: 'transactions' as const, label: 'Transactions', icon: ArrowLeftRight },
    { id: 'deals' as const, label: 'Deals', icon: Handshake },
  ]

  return (
    <div className="px-4 pt-5 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Records</h1>
      </div>

      <div className="flex gap-1.5 mb-4 bg-slate-100 p-1 rounded-xl">
        {tabs.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
              tab === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
          >
            <item.icon size={13} />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'transactions' ? (
        <TransactionsView
          parts={parts}
          transfers={transfers}
          expenses={expenses}
          isSupervisor={isSupervisor}
          embedded
        />
      ) : (
        <DealsList
          initialDeals={deals}
          parts={parts}
          paidMap={paidMap}
          isSupervisor={isSupervisor}
          embedded
        />
      )}
    </div>
  )
}
