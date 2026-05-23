# Agent Rules — Hisaab

## ⚠️ Read the docs first

Before writing any code, read:
- `docs/product.md` — what the app does, roles, pages, business logic
- `docs/technical.md` — stack, schema, API patterns, auth, migrations, patterns

---

## Next.js version warning

This is **not** the Next.js you know from training data. APIs, conventions, and file structure may differ. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js-specific code. Heed deprecation notices.

---

## Where things live

| Task | File to change |
|------|---------------|
| Home tab UI (Overview, Expenses, Transfers, Deals) | `app/(app)/home/HomeView.tsx` |
| Home server data fetching / auth | `app/(app)/home/page.tsx` |
| Owner module (owner role only) | `app/(app)/owner/page.tsx`, `app/(app)/owner/OwnerView.tsx` (shares the (app) shell) |
| Joint Home (combined supervisor + owner spend) | `components/CombinedReportView.tsx` rendered by `app/(app)/joint/page.tsx`; legacy `/reports/combined` & `/owner/report` redirect to `/joint` |
| App Users provisioning (promote to owner) | `app/(app)/settings/users/`, `app/api/admin/users/route.ts` |
| Write Logs page | `app/logs/page.tsx` |
| Page Visits page | `app/(app)/visits/page.tsx` |
| Add/edit transfer sheet | `components/TransferSheet.tsx` |
| Add/edit expense sheet | `components/ExpenseSheet.tsx` |
| Add/edit deal sheet | `components/DealSheet.tsx` |
| Navigation (bottom nav + sidebar) | `components/BottomNav.tsx`, `components/Sidebar.tsx` |
| Visit tracking | `components/PageVisitTracker.tsx` |
| API routes | `app/api/<entity>/route.ts` |
| TypeScript types + DB schema map | `lib/types.ts` |

---

## Critical gotchas

### 1. `useSearchParams()` requires `<Suspense>`
Any client component using `useSearchParams()` must be wrapped in `<Suspense>` in its parent layout. Without it, the component silently fails to mount in Next.js 14+. `PageVisitTracker` already has this in `app/(app)/layout.tsx` — don't remove it.

### 2. Always include `entity_date` in activity log inserts
Every write to `activity_logs` that touches an expense, transfer, or deal must include:
```typescript
entity_date: <entity>.date
```
Omitting this breaks the "Unusual only" backdating filter on the logs page.

### 3. Transfer `part_id` is never sent from the client
The transfer API auto-resolves `part_id` from the owner's record in `people`. Never add a `part_id` field to transfer forms.

### 4. Expense allocations replace on update
PUT `/api/expenses` deletes all existing `expense_allocations` for the expense and re-inserts. Do not patch individual allocation rows.

### 5. Period pill href must always set `period=`
When building `periodHref()` for date pills, always write the period param — even for `'all'`. If you skip it for `'all'`, clicking "All time" navigates to a URL without the param and the page defaults back to `week`, making the pill appear wrong.

### 6. Unusual filter bypasses period
When `unusualOnly` is true on the logs page, the period date filter must be skipped:
```typescript
const from = unusualOnly ? null : periodFrom(period)
```

### 7. No `router.refresh()` after mutations
All lists use optimistic UI — the API response is merged into local state. Do not call `router.refresh()` after create/update/delete.

### 8. `/logs` is outside the `(app)` layout group
`app/logs/page.tsx` does not render inside the authenticated shell (no bottom nav). This is intentional — it's an admin page known only by URL. Do not move it inside `(app)`.

### 9. `x-vercel-ip-country` only works in production
The country header is injected by Vercel's edge network. It is always null on localhost. Do not try to mock it or add a workaround — just accept that country data is production-only.

### 10. `entity_id` is a `uuid` column, not `text`
When joining `activity_logs` with entity tables in SQL, use `al.entity_id = e.id` directly — no `::text` cast needed. Postgres will error if you add one.

### 11. Supervisor screens must filter `source='supervisor'`
`expenses` now has a `source` column. Any supervisor-facing read of `expenses` (home, cashbook, deal paid-totals, deal-context lookups) MUST add `.eq('source', 'supervisor')`, or owner-direct expenses will leak into the supervisor workspace and inflate balances/deal payments. The owner module reads `source='owner'`; the Combined Report reads both.

### 12. Never trust client-supplied `source`/`part_id` for owner writes
In `/api/expenses`, owner-role requests are server-stamped: `source='owner'`, `created_by=user.id`, and a single allocation pinned to `profiles.part_id`. Do not pass these through from the request body. RLS (migration 017) enforces the same — don't weaken it.

### 13. Owners are scoped by `profiles.part_id`, not the `people` table
The owner→part link for login accounts lives on `profiles.part_id` (with a CHECK that owners must have one). This is separate from `people.part_id` (which is for transfer auto-resolution). Don't conflate them.

---

## Patterns to follow

### Supervisor-only guard (server components)
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')  // or return access-denied JSX for non-redirect pages
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
if ((profile as { role?: string } | null)?.role !== 'supervisor') {
  return <div className="px-4 pt-5"><p className="text-sm text-slate-400">Supervisor access required.</p></div>
}
```

### Activity log insert (always include entity_date)
```typescript
await supabase.from('activity_logs').insert({
  action: 'CREATE',            // or 'UPDATE' / 'DELETE'
  entity_type: 'expense',      // expense | transfer | deal | deal_revision | category | project_part
  entity_id: record.id,
  entity_date: record.date,    // the entity's own date field — do not omit
  summary: `Added expense "${description}" PKR ${total_amount}`,
  changes: { before, after },  // omit for CREATE; include for UPDATE and DELETE
  performed_by: user.id,
})
```

### Period filter with pills (date-scoped pages)
```typescript
const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'Week'  },
  { id: 'month', label: 'Month' },
  { id: 'all',   label: 'All time' },
] as const
type Period = typeof PERIODS[number]['id']

// Default to 'week' unless specified
const period = (param(params.period) ?? 'week') as Period

// Href always writes period
function periodHref(p: Period) {
  const sp = new URLSearchParams({ ...otherParams, period: p })
  return `/page?${sp.toString()}`
}

// Apply to query
const from = periodFrom(period)  // returns null for 'all'
if (from) query = query.gte('performed_at', `${from}T00:00:00+05:00`)
```

### Optimistic list mutation
```typescript
const [items, setItems] = useState(initialItems)

function handleSaved(data: EnrichedType) {
  setItems(prev => editing
    ? prev.map(x => x.id === data.id ? data : x)
    : [data, ...prev]
  )
}
async function handleDelete(id: string) {
  const res = await fetch('/api/entity', { method: 'DELETE', body: JSON.stringify({ id }) })
  if (res.ok) setItems(prev => prev.filter(x => x.id !== id))
}
```

---

## Navigation rules

- **The core app is identical for every role.** `BottomNav.tsx` shows the same 3 items for everyone — Home, Cashbook, Settings — and `/home` is the landing page for all users. Do not make the bottom nav or landing page role-divergent.
- **The owner module and Joint Home are sidebar-only extras** (`Sidebar.tsx`, sectioned by `userRole`):
  - **Owner** sees an **Owner** section (`/owner` — Owner Home) and a **Joint** section (`/joint` — Joint Home, defaults to their part).
  - **Supervisor** sees a **Joint** section (`/joint` — Joint Home, all parts).
  - These never appear in the bottom nav.
- **Do not add** `/logs` or `/visits` to navigation — they are intentionally URL-only admin pages
- Owners are **not** redirected out of the supervisor shell — they share it read-only. `isSupervisor` (role === 'supervisor') gates write controls, so owners/viewers see the supervisor app without Add/edit/delete.

---

## Adding a new migration

1. Create `supabase/migrations/NNN_description.sql`
2. Add the migration to the table in `docs/technical.md`
3. Run the SQL manually in Supabase SQL Editor
4. Update `lib/types.ts` if columns were added or changed
