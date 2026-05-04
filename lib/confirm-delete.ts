export function confirmTypedDelete(message: string) {
  const entered = window.prompt(`${message}\n\nThis cannot be undone.\nType delete to confirm.`)
  return entered?.trim().toLowerCase() === 'delete'
}
