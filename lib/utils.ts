import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPKR(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function amountHint(value: string | number): string {
  const n = Number(value)
  if (!n || n < 1000) return ''
  if (n >= 100000) {
    const lac = n / 100000
    return `${lac % 1 === 0 ? lac : parseFloat(lac.toFixed(1))} lac`
  }
  const k = n / 1000
  return `${k % 1 === 0 ? k : parseFloat(k.toFixed(1))}k`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
