// Shared thin progress bar — used for share/breakdown meters across reports.
export default function ShareMeter({ percent, color, className }: {
  percent: number
  color: string
  className?: string
}) {
  return (
    <div className={className ?? 'mt-2'} aria-label={`Share ${percent.toFixed(0)} percent`}>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
