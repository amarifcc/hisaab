'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export default function CacheRefreshButton({ compact = false }: { compact?: boolean }) {
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  async function handleRefresh() {
    setRefreshing(true)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(key => caches.delete(key)))
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          registration.active?.postMessage({ type: 'CLEAR_CACHES' })
          registration.waiting?.postMessage({ type: 'CLEAR_CACHES' })
          await registration.update().catch(() => {})
        }
      }

      router.refresh()
    } finally {
      window.setTimeout(() => setRefreshing(false), 400)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={refreshing}
      title="Clear cached shell and refresh data"
      aria-label="Clear cached shell and refresh data"
      className={cn(
        'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 active:text-blue-600 transition-colors disabled:opacity-60',
        compact ? 'w-8 h-8' : 'w-9 h-9'
      )}
    >
      <RefreshCw size={compact ? 16 : 17} className={cn(refreshing && 'animate-spin')} />
    </button>
  )
}
