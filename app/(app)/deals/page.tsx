import { redirect } from 'next/navigation'

export default function DealsPage() {
  redirect('/records?tab=deals')
}
