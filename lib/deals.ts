import type { DealWithPart } from '@/lib/types'

export function dealTotal(deal: Pick<DealWithPart, 'agreed_amount' | 'deal_revisions'>): number {
  const revisionTotal = deal.deal_revisions?.reduce((sum, revision) => sum + Number(revision.amount_delta), 0) ?? 0
  return deal.deal_revisions?.length ? revisionTotal : Number(deal.agreed_amount)
}

export function sortedDealRevisions(deal: Pick<DealWithPart, 'deal_revisions'>) {
  return [...(deal.deal_revisions ?? [])].sort((a, b) => a.revision_number - b.revision_number)
}
