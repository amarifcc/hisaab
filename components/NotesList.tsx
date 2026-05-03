import { parseNoteLines } from '@/lib/notes'
import { cn } from '@/lib/utils'

interface Props {
  notes?: string | null
  className?: string
}

export default function NotesList({ notes, className }: Props) {
  const lines = parseNoteLines(notes)
  if (!lines.length) return null

  return (
    <ul className={cn('mt-1 space-y-0.5 text-xs text-slate-400 list-disc pl-4', className)}>
      {lines.map((line, index) => (
        <li key={`${index}-${line}`}>{line}</li>
      ))}
    </ul>
  )
}
