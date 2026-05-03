export function parseNoteLines(notes?: string | null): string[] {
  return (notes ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

export function formatNoteLines(lines: string[]): string {
  return lines
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}
