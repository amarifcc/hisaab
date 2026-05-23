import { redirect } from 'next/navigation'
import { recordServerPageVisit } from '@/lib/page-visits'

export default async function OwnerReportRedirectPage() {
  await recordServerPageVisit('/owner/report')
  redirect('/joint')
}
