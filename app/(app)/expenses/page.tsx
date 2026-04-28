export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import ExpensesList from './ExpensesList'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isSupervisor = false
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isSupervisor = (data as { role?: string } | null)?.role === 'supervisor'
  }

  const [{ data: expenses }, { data: parts }, { data: categories }] = await Promise.all([
    supabase.from('expenses').select('*, categories(*), expense_allocations(*, project_parts(*))').order('date', { ascending: false }),
    supabase.from('project_parts').select('*').order('sort_order'),
    supabase.from('categories').select('*').order('name'),
  ])

  return (
    <ExpensesList
      initialExpenses={expenses ?? []}
      parts={parts ?? []}
      categories={categories ?? []}
      isSupervisor={isSupervisor}
    />
  )
}
