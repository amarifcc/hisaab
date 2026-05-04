const PKT_OFFSET = '+05:00'

function formatDatePKT(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(date)
}

function shiftedDate(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return formatDatePKT(date)
}

export function dateStart(date?: string) {
  return date ? `${date}T00:00:00${PKT_OFFSET}` : undefined
}

export function dateEnd(date?: string) {
  return date ? `${date}T23:59:59${PKT_OFFSET}` : undefined
}

export function quickDateRanges() {
  const today = shiftedDate(0)
  const yesterday = shiftedDate(-1)

  return [
    { label: 'Today', from: today, to: today },
    { label: 'Yesterday', from: yesterday, to: yesterday },
    { label: '7 days', from: shiftedDate(-6), to: today },
    { label: '30 days', from: shiftedDate(-29), to: today },
  ]
}

export function dateRangeHref(pathname: string, params: Record<string, string>, from: string, to: string) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value)
  }
  next.set('from', from)
  next.set('to', to)
  return `${pathname}?${next.toString()}`
}

export function clearDateRangeHref(pathname: string, params: Record<string, string>) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value)
  }
  const query = next.toString()
  return query ? `${pathname}?${query}` : pathname
}
