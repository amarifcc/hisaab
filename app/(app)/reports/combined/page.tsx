import { redirect } from 'next/navigation'
import { recordServerPageVisit } from '@/lib/page-visits'

export default async function CombinedReportRedirectPage() {
  await recordServerPageVisit('/reports/combined')
  redirect('/joint')
}
