'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { formatNoteLines, parseNoteLines } from '@/lib/notes'

interface Props {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
}

export default function NotesEditor({ value, onChange, label = 'Notes', placeholder = 'Add detail...' }: Props) {
  const [rows, setRows] = useState<string[]>(() => {
    const lines = parseNoteLines(value)
    return lines.length ? lines : ['']
  })
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (value === lastEmitted.current) return
    const lines = parseNoteLines(value)
    setRows(lines.length ? lines : [''])
  }, [value])

  function updateRows(nextRows: string[]) {
    setRows(nextRows)
    const nextValue = formatNoteLines(nextRows)
    lastEmitted.current = nextValue
    onChange(nextValue)
  }

  function updateRow(index: number, nextValue: string) {
    const nextRows = [...rows]
    nextRows[index] = nextValue
    updateRows(nextRows)
  }

  function addRow(afterIndex?: number) {
    const nextRows = [...rows]
    nextRows.splice(afterIndex === undefined ? nextRows.length : afterIndex + 1, 0, '')
    updateRows(nextRows)
  }

  function removeRow(index: number) {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index)
    updateRows(nextRows.length ? nextRows : [''])
  }

  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1.5 block">{label}</label>
      <div className="space-y-2">
        {rows.map((line, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
            <input
              type="text"
              value={line}
              onChange={e => updateRow(index, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addRow(index)
                }
              }}
              placeholder={placeholder}
              className="min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 active:text-red-500"
              aria-label="Remove note"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => addRow()}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700"
      >
        <Plus size={13} />
        Add note
      </button>
    </div>
  )
}
