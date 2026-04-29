# Hisaab — Technical Reference

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router (see `AGENTS.md` — read `node_modules/next/dist/docs/` before writing Next.js code) |
| Database | Supabase (Postgres + Auth + RLS) |
| Auth | Supabase SSR (`@supabase/ssr`) |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Share/Export | `html2canvas` + Web Share API |
| Deployment | Vercel (assumed) |

---

## File Structure

```
app/
  (auth)/login/         — Login page
  (app)/                — Authenticated shell with bottom nav
    page.tsx            — Redirects to reports
    transfers/          — Transfers list page
    expenses/           — Expenses list page
    transactions/       — Combined transfer + expense ledger
    deals/              — Deals list page
    reports/            — Reports page (server fetches all data)
    settings/
      categories/       — Category CRUD
      parts/            — Project part CRUD
      people/           — People/contacts CRUD

components/
  Sidebar.tsx           — Bottom nav + slide-out drawer
  TransferSheet.tsx     — Add/edit transfer bottom sheet
  ExpenseSheet.tsx      — Add/edit expense bottom sheet
  DealSheet.tsx         — Add/edit deal bottom sheet

lib/
  types.ts              — All TypeScript interfaces
  utils.ts              — formatPKR, formatDate, cn
  supabase/
    client.ts           — Browser Supabase client
    server.ts           — Server Supabase client (SSR cookies)

supabase/migrations/    — Sequential SQL migrations (run in Supabase SQL Editor)

docs/
  product.md            — Product reference (features, flows, business logic)
  technical.md          — This file
```

---

## Database Schema

### `project_parts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Full name, e.g. "Ground Floor" |
| short_name | text | Compact label, e.g. "GF" |
| color | text | Hex color, used throughout UI |
| sort_order | int | Display order |

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | References `auth.users` |
| name | text | |
| role | text | `'supervisor'` or `'viewer'` |

Auto-created on signup via `handle_new_user()` trigger. Default role is `viewer`.

### `transfers`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| part_id | uuid FK | Resolved automatically from owner's assigned part |
| from_person | text | Owner name (matches `people.name`) |
| amount | numeric | > 0 |
| date | date | Occurrence date |
| notes | text | |

### `expenses`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| description | text | |
| total_amount | numeric | Sum of all allocations |
| paid_to | text | Contractor/supplier name (soft link to `people.name`) |
| category_id | uuid FK | References `categories` |
| date | date | |

Split into parts via `expense_allocations`.

### `expense_allocations`
| Column | Type | Notes |
|--------|------|-------|
| expense_id | uuid FK | Cascade delete |
| part_id | uuid FK | |
| amount | numeric | Per-part amount |
| UNIQUE | (expense_id, part_id) | |

### `deals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Description of the contracted work |
| person_name | text | Contractor name (soft link to `people.name`) |
| part_id | uuid FK | |
| agreed_amount | numeric | |
| date | date | |

"Paid" amount is computed at query time from `expenses.paid_to` matching `person_name`.

### `people`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text UNIQUE | Used as soft FK in transfers and expenses |
| person_type | text | `owner`, `contractor`, `employee`, `supplier` |
| part_id | uuid FK nullable | Required for owners; used to auto-resolve transfer part |

### `categories`
Standard lookup table: id, name, color.

---

## API Routes

All routes are in `app/api/`. Pattern: POST = create, PUT = update (body includes `id`), DELETE (body includes `id`).

All mutating routes check supervisor role:
```typescript
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
if ((profile as any)?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Response contract for optimistic UI
All POST and PUT routes return the fully enriched record (with joins) so the client can update local state without a page refresh:
- `transfers`: returns `*, project_parts(*)`
- `expenses`: re-fetches after insert/update: `*, categories(*), expense_allocations(*, project_parts(*))`
- `deals`: returns `*, project_parts(*)`

### Transfer part auto-resolution (`/api/transfers`)
POST and PUT do NOT accept `part_id` from the client. Instead:
```typescript
const { data: owner } = await supabase
  .from('people')
  .select('part_id')
  .eq('name', from_person.trim())
  .eq('person_type', 'owner')
  .single()
if (!owner?.part_id) return NextResponse.json({ error: '...' }, { status: 400 })
```

### Expense allocations
On POST: insert expense, then insert one row per part into `expense_allocations`, then re-fetch with joins.
On PUT: delete all existing allocations for the expense, re-insert, then re-fetch.

---

## Auth Pattern

Server components and API routes use:
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

Role check shorthand (avoids TypeScript complaints):
```typescript
const isSupervisor = (profile as any)?.role === 'supervisor'
```

RLS policies enforce the same role check at the database level — the API check is defense-in-depth.

---

## Client State Pattern (Optimistic UI)

All list pages follow this pattern — **no `router.refresh()` after mutations**:

```typescript
// Initial data from server props
const [items, setItems] = useState(initialItems)

// After add: API returns enriched record
function handleSaved(data: any) {
  if (editing) {
    setItems(prev => prev.map(x => x.id === data.id ? data : x))
  } else {
    setItems(prev => [data, ...prev])
  }
}

// After delete: filter out locally
async function handleDelete(id: string) {
  const res = await fetch('/api/...', { method: 'DELETE', body: JSON.stringify({ id }) })
  if (res.ok) setItems(prev => prev.filter(x => x.id !== id))
}
```

Sheets (`TransferSheet`, `ExpenseSheet`, `DealSheet`) accept `onSaved: (data: any) => void` and call it with the API response before closing.

---

## Part Filter Persistence

Each page persists its part filter in localStorage:

| Page | Key |
|------|-----|
| Transactions | `hisab_transactions_filter_part` |
| Expenses | `hisab_expenses_filter_part` |
| Transfers | `hisab_transfers_filter_part` |
| Deals | `hisab_deals_filter_part` |
| Reports | `hisab_reports_filter_part` |

Pattern:
```typescript
const [filterPart, setFilterPart] = useState('all')
useEffect(() => {
  const saved = localStorage.getItem(KEY)
  if (saved) setFilterPart(saved)
}, [])
function changeFilter(val: string) {
  setFilterPart(val)
  localStorage.setItem(KEY, val)
}
```

---

## Migrations

Run each file in `supabase/migrations/` in numeric order via Supabase SQL Editor. They are not managed by the Supabase CLI — manual execution only.

| File | Purpose |
|------|---------|
| `001_initial_schema.sql` | Core tables: project_parts, profiles, categories, transfers, expenses, expense_allocations, activity_logs. All RLS policies. |
| `002_people_table.sql` | `people` table for contacts autocomplete |
| `003_fix_profiles_trigger.sql` | Fixes the auto-create profile trigger |
| `004_people_type.sql` | Adds `person_type` column to people |
| `005_deals.sql` | `deals` table; extends activity_logs entity_type constraint |
| `006_people_employee_type.sql` | Adds `employee` to person_type enum |
| `007_owner_part.sql` | Adds `part_id` FK to people (required for transfer auto-resolution) |

**Pending for existing owners**: After running 007, go to Settings → People and edit each owner to assign their project part. Until this is done, transfers cannot be recorded for those owners.

---

## PWA Configuration

- `public/manifest.json` — app name "Hisaab", icons, display: standalone
- `app/layout.tsx` — Apple web app meta tags (`apple-mobile-web-app-title: "Hisaab"`)
- `no-scrollbar` utility class used for horizontal chip/filter rows (defined in global CSS)
