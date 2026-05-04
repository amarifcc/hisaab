'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const DUPLICATE_WINDOW_MS = 5000

export default function PageVisitTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return

    const query = searchParams.toString()
    const key = `visit:${pathname}?${query}`
    const now = Date.now()
    const last = Number(sessionStorage.getItem(key) ?? 0)
    if (now - last < DUPLICATE_WINDOW_MS) return
    sessionStorage.setItem(key, String(now))

    fetch('/api/page-visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pathname,
        query,
        referrer: document.referrer || null,
      }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname, searchParams])

  return null
}
