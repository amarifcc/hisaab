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
| Deployment | Vercel |

---

## File Structure

```
app/
  (auth)/login/              — Login page
  (app)/                     — Authenticated shell with BottomNav + Sidebar
    layout.tsx               — Wraps PageVisitTracker in <Suspense> — required
    page.tsx                 — Redirects to /home
    home/
      page.tsx               — Server component: fetches all data, passes to HomeView
      HomeView.tsx           — Client component: all four tabs + part filter
    visits/
      page.tsx               — Page Visits admin page (supervisor only, not in nav)
    settings/
      categories/            — Category CRUD
      parts/                 — Project part CRUD
      people/                — People/contacts CRUD
      users/                 — App Users: promote viewer→owner + assign part (supervisor only)
    reports/
      combined/              — Redirects to /joint
    joint/
      page.tsx               — Joint Home: view-only supervisor + owner spend
    owner/                   — Owner module (owner role only; shares the (app) shell)
      page.tsx               — Owner Home: owner's own owner-source expenses (server) → OwnerView
      OwnerView.tsx          — Client: Overview / Expenses / Categories + ExpenseSheet (locked part, source='owner')
      report/page.tsx        — Redirects to /joint
    [legacy redirects]       — /transfers, /expenses, /deals, /records,
                               /transactions, /reports all redirect to /home

  logs/                      — Write Logs admin page (outside (app) group, no nav shell)
    page.tsx                 — Supervisor-only audit trail

  api/
    expenses/route.ts        — POST / PUT / DELETE expenses + allocations
    transfers/route.ts       — POST / PUT / DELETE transfers
    deals/route.ts           — POST / PUT / DELETE deals + revisions (PATCH)
    categories/route.ts      — Category CRUD
    parts/route.ts           — Project part CRUD
    people/route.ts          — People CRUD
    page-visits/route.ts     — POST only: records a page view
    admin/users/route.ts     — GET/PUT profiles: supervisor sets role + part_id (owner provisioning)

components/
  BottomNav.tsx              — Mobile bottom navigation (Home, Cashbook, Settings)
  Sidebar.tsx                — Sectioned drawer nav: Supervisor / Owner / Joint / Settings
  PageVisitTracker.tsx       — Client component; fires POST /api/page-visits on nav
  page-visits.ts             — Server helper for visits that happen before client mount (redirect pages)
  TransferSheet.tsx          — Add/edit transfer bottom sheet
  ExpenseSheet.tsx           — Add/edit expense bottom sheet
  DealSheet.tsx              — Add/edit deal bottom sheet

lib/
  types.ts                   — All TypeScript interfaces and Database type map
  utils.ts                   — formatPKR, formatDate, cn
  date-ranges.ts             — dateStart / dateEnd helpers (used by visits/logs queries)
  supabase/
    client.ts                — Browser Supabase client
    server.ts                — Server Supabase client (SSR cookies)

supabase/migrations/         — Sequential SQL migrations (manual: run in Supabase SQL Editor)

docs/
  product.md                 — Product reference (features, flows, business logic)
  technical.md               — This file
```

---

## Route Ownership

`/home` is Supervisor Home, the supervisor-managed finance workspace. `app/(app)/home/page.tsx` owns server-side Supabase reads and passes data into `app/(app)/home/HomeView.tsx`.

| Visible tab / view | File |
|-------------------|------|
| Overview | `HomeView.tsx` → `PartsReport` |
| Expenses → List | `HomeView.tsx` → `ExpensesListReport` |
| Expenses → Category | `HomeView.tsx` → `CategoriesReport` |
| Expenses → Person | `HomeView.tsx` → `PeopleReport` |
| Transfers | `HomeView.tsx` → `TransfersListReport` |
| Deals | `HomeView.tsx` → `DealsReport` / `DealPersonCard` |
| Owner Home | `app/(app)/owner/page.tsx` → `OwnerView.tsx` |
| Joint Home | `app/(app)/joint/page.tsx` → `components/CombinedReportView.tsx`; legacy `/reports/combined` and `/owner/report` redirect to `/joint` |
| Write Logs | `app/logs/page.tsx` (server, outside (app) group) |
| Page Visits | `app/(app)/visits/page.tsx` (server) |

All legacy routes redirect to `/home`. When product requests mention those tabs as pages, update `HomeView.tsx` unless the request is about data loading in `home/page.tsx`.

**Note on `/logs`:** It lives outside the `(app)` group on purpose — it does not show the bottom nav shell. The supervisor navigates there by typing the URL directly. It is still a server component with its own supervisor guard.

---

## Database Schema

### `project_parts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | e.g. "Ground Floor" |
| short_name | text | e.g. "GF" |
| color | text | Hex color used throughout UI |
| sort_order | int | Display order |

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | References `auth.users` |
| name | text | |
| role | text | `'supervisor'`, `'owner'`, or `'viewer'` |
| part_id | uuid FK nullable | Owner's assigned part. CHECK: required when role=`owner`, must be null otherwise. `on delete restrict`. |

Auto-created on signup via `handle_new_user()` trigger. Default role is `viewer`. Promoted to `owner`/`supervisor` via Settings → App Users (or SQL).

### `transfers`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| part_id | uuid FK | Resolved automatically from owner's assigned part |
| from_person | text | Owner name (matches `people.name`) |
| amount | numeric | > 0 |
| date | date | Occurrence date |
| notes | text | |
| ref_number | int | Auto-incrementing display reference |
| created_by | uuid FK | |

### `expenses`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| description | text | |
| total_amount | numeric | Sum of all allocations |
| paid_to | text | Contractor/supplier name (soft FK to `people.name`) |
| category_id | uuid FK | |
| date | date | |
| ref_number | int | Auto-incrementing display reference |
| source | text | `'supervisor'` (default) or `'owner'`. Supervisor screens filter `source='supervisor'`; owner module reads `source='owner'`. |
| created_by | uuid FK | |

### `expense_allocations`
| Column | Type | Notes |
|--------|------|-------|
| expense_id | uuid FK | Cascade delete |
| part_id | uuid FK | |
| amount | numeric | Per-part allocation |
| UNIQUE | (expense_id, part_id) | |

### `deals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Description of contracted work |
| person_name | text | Contractor name (soft FK to `people.name`) |
| part_id | uuid FK | |
| agreed_amount | numeric | Running total; revision sum is source of truth |
| date | date | |

### `deal_revisions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| deal_id | uuid FK | Cascade delete with deal |
| revision_number | int | Unique per deal |
| scope_description | text | Original or changed scope |
| amount_delta | numeric | Positive or negative |
| date | date | |

### `people`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text UNIQUE | Soft FK used in transfers and expenses |
| person_type | text | `owner`, `contractor`, `employee`, `supplier` |
| part_id | uuid FK nullable | Required for owners; used to auto-resolve transfer part |

### `categories`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| color | text | |
| parent_id | uuid FK nullable | For hierarchy |
| is_group | boolean | Group-only category (cannot be assigned to expenses) |

### `activity_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| action | text | `CREATE`, `UPDATE`, `DELETE` |
| entity_type | text | `expense`, `transfer`, `deal`, `deal_revision`, `category`, `project_part` |
| entity_id | uuid nullable | ID of the affected row |
| entity_date | date nullable | The transaction's own date field (e.g. expense.date). Used for backdating detection. |
| summary | text | Human-readable one-liner |
| changes | jsonb nullable | `{ before, after }` for UPDATE; `{ after }` for CREATE; `{ before }` for DELETE |
| performed_by | uuid FK nullable | |
| performed_at | timestamptz | Default: now() |

**Backdating detection:** flag a log as unusual when `(performed_at − entity_date) > 48 hours` AND action is CREATE or UPDATE AND entity_type is expense, transfer, or deal. Implemented in `app/logs/page.tsx` as `isUnusual()`.

### `page_visits`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | |
| path | text | URL path, e.g. `/home` |
| query | text nullable | Raw query string (without `?`) |
| referrer | text nullable | |
| user_agent | text nullable | Full UA string, parsed for display |
| country | text nullable | ISO 3166-1 alpha-2 code from `x-vercel-ip-country` header. Only populated in Vercel production, always null on localhost. |
| visited_at | timestamptz | Default: now() |

---

## Migrations

Run each file in `supabase/migrations/` in numeric order via Supabase SQL Editor. Not managed by the Supabase CLI — manual execution only.

| File | Purpose |
|------|---------|
| `001_initial_schema.sql` | Core tables: project_parts, profiles, categories, transfers, expenses, expense_allocations, activity_logs. All RLS policies. |
| `002_people_table.sql` | `people` table for contacts autocomplete |
| `003_fix_profiles_trigger.sql` | Fixes the auto-create profile trigger |
| `004_people_type.sql` | Adds `person_type` to people |
| `005_deals.sql` | `deals` table; extends activity_logs entity_type constraint |
| `006_people_employee_type.sql` | Adds `employee` to person_type enum |
| `007_owner_part.sql` | Adds `part_id` FK to people (required for transfer auto-resolution) |
| `008_category_hierarchy.sql` | Category hierarchy support |
| `009_category_is_group.sql` | Category group flag |
| `010_reference_numbers.sql` | Transaction reference numbers |
| `011_deal_revisions.sql` | Deal revision history; backfills existing deal totals |
| `012_page_visits.sql` | `page_visits` table for analytics tracking |
| `013_page_visits_country.sql` | Adds `country text` to `page_visits` |
| `014_activity_logs_entity_date.sql` | Adds `entity_date date` to `activity_logs` |
| `015_owner_role_and_part.sql` | Adds `'owner'` role; adds `profiles.part_id` FK (owner→part, `on delete restrict`); CHECK enforces owner⇒part set, non-owner⇒null |
| `016_expense_source.sql` | Adds `expenses.source` (`'supervisor'`\|`'owner'`, default `'supervisor'`); backfills existing rows |
| `017_owner_rls.sql` | `is_supervisor()` / `owner_part_id()` SQL helpers; owner write RLS on expenses + allocations (own owner-source rows, pinned to own part); supervisor-can-update-any-profile policy |

**After migration 014:** run the backfill SQL to populate `entity_date` on historical logs:
```sql
-- UPDATE logs: extract from changes JSON
UPDATE activity_logs SET entity_date = (changes->'after'->>'date')::date
WHERE action='UPDATE' AND entity_date IS NULL
  AND entity_type IN ('expense','transfer','deal')
  AND (changes->'after'->>'date') IS NOT NULL;

UPDATE activity_logs SET entity_date = (changes->'before'->>'date')::date
WHERE action='UPDATE' AND entity_date IS NULL
  AND entity_type IN ('expense','transfer','deal')
  AND (changes->'before'->>'date') IS NOT NULL;

-- CREATE logs: join with entity tables
UPDATE activity_logs al SET entity_date = e.date FROM expenses e
WHERE al.entity_id = e.id AND al.action='CREATE' AND al.entity_type='expense' AND al.entity_date IS NULL;

UPDATE activity_logs al SET entity_date = t.date FROM transfers t
WHERE al.entity_id = t.id AND al.action='CREATE' AND al.entity_type='transfer' AND al.entity_date IS NULL;

UPDATE activity_logs al SET entity_date = d.date FROM deals d
WHERE al.entity_id = d.id AND al.action='CREATE' AND al.entity_type='deal' AND al.entity_date IS NULL;
```

---

## API Routes

All routes are in `app/api/`. Pattern: POST = create, PUT = update (body includes `id`), DELETE (body includes `id`). PATCH on deals = add/edit a revision.

All mutating routes check supervisor role before any DB operation:
```typescript
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
if ((profile as any)?.role !== 'supervisor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Owner expense writes (`/api/expenses`)
`/api/expenses` is the one mutating route that also accepts the `owner` role. It uses `getActor()` (returns `{ role, part_id }`) and branches:
- **Supervisor**: stamps `source='supervisor'`, accepts client `allocations` as-is (single or split).
- **Owner**: the server **always** stamps `source='owner'`, `created_by=user.id`, and **constructs** a single allocation `[{ part_id: profile.part_id, amount: total_amount }]` — the client's `source`/`allocations`/`part_id` are ignored. PUT/DELETE additionally require the target row to be `source='owner'` AND `created_by=me`.

RLS is the real wall (the route uses the user's RLS-bound client). Owner policies (migration 017) block forging a supervisor expense or writing to another part even if the API branch is bypassed. SELECT stays open (`using(true)`) — owner view scoping is done in the app layer (owner pages only query their own part/rows).

### Activity log inserts
Every mutating operation appends a row to `activity_logs`. Always include `entity_date` from the entity's own `date` field:
```typescript
await supabase.from('activity_logs').insert({
  action: 'CREATE', entity_type: 'expense', entity_id: expense.id,
  entity_date: expense.date,   // ← required for backdating detection
  summary: `Added expense "${description}" PKR ${total_amount}`,
  performed_by: user.id,
})
```

### Response contract (optimistic UI)
POST and PUT return the fully enriched record (with joins) so the client can update local state without a page refresh:
- `transfers` → `*, project_parts(*)`
- `expenses` → re-fetched: `*, categories(*), expense_allocations(*, project_parts(*))`
- `deals` → `*, project_parts(*), deal_revisions(*)`

### Transfer part auto-resolution
POST and PUT do NOT accept `part_id` from the client:
```typescript
const { data: owner } = await supabase.from('people').select('part_id')
  .eq('name', from_person.trim()).eq('person_type', 'owner').single()
if (!owner?.part_id) return NextResponse.json({ error: '...' }, { status: 400 })
```

### Page visits (`/api/page-visits`)
POST only. Reads `user-agent` and `x-vercel-ip-country` from request headers:
```typescript
const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null
const country   = req.headers.get('x-vercel-ip-country') ?? null
```
`x-vercel-ip-country` is only present in Vercel production. Always null on localhost.

---

## Auth Pattern

Server components and API routes:
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

Role check shorthand:
```typescript
const isSupervisor = (profile as any)?.role === 'supervisor'
```

RLS policies enforce the same check at the DB level — the API check is defense-in-depth.

---

## Client State Pattern (Optimistic UI)

No `router.refresh()` after mutations. All list pages follow:

```typescript
const [items, setItems] = useState(initialItems)

// After add/edit — API returns enriched record
function handleSaved(data: any) {
  if (editing) {
    setItems(prev => prev.map(x => x.id === data.id ? data : x))
  } else {
    setItems(prev => [data, ...prev])
  }
}

// After delete
async function handleDelete(id: string) {
  const res = await fetch('/api/...', { method: 'DELETE', body: JSON.stringify({ id }) })
  if (res.ok) setItems(prev => prev.filter(x => x.id !== id))
}
```

Sheets (`TransferSheet`, `ExpenseSheet`, `DealSheet`) accept `onSaved: (data: any) => void` and call it with the API response before closing.

---

## Page Visit Tracking

`PageVisitTracker` is a client component mounted in `app/(app)/layout.tsx`. It uses `useSearchParams()` which requires a `<Suspense>` boundary — **without this the component silently fails to mount and no visits are recorded**:

```tsx
// app/(app)/layout.tsx
import { Suspense } from 'react'
import PageVisitTracker from '@/components/PageVisitTracker'

// Inside the layout:
<Suspense fallback={null}>
  <PageVisitTracker />
</Suspense>
```

On every route change it POSTs `{ path, query, referrer }` to `/api/page-visits`.

Server-only redirect pages that may not mount the client tracker should call `recordServerPageVisit(path)` before `redirect()`. Current examples: legacy `/owner/report` and `/reports/combined` record their old path, then redirect to `/joint`.

---

## Device Parsing (Visits Page)

`parseDevice(ua)` in `app/(app)/visits/page.tsx` extracts a friendly device label:
- iPhone / iPad → as-is
- Android → regex extracts model from Build string; brand detected from model prefix (SM- → Samsung, Pixel → Google, RMX → Realme, CPH → OPPO, etc.)
- Desktop → Windows / Mac / Linux

Returns `{ label: string; type: 'mobile' | 'desktop' }`. Type controls whether `Smartphone` (blue) or `Monitor` (grey) icon is shown.

---

## Admin Pages — Period Filter Pattern

Both `/logs` and `/visits` use the same period pill pattern: Today / Week (default) / Month / All time.

Period pills are `<Link>` elements that encode the period in the URL (`?period=week`). The form has a `<input type="hidden" name="period" value={period} />` to preserve the period on form submit. The `periodHref()` helper always writes `period` to the URL (including for `all`) so clicking "All time" doesn't cause the pill to snap back to the default:

```typescript
function periodHref(p: Period) {
  const sp = new URLSearchParams()
  // ... other params ...
  sp.set('period', p)  // always set — even for 'all'
  return `/logs?${sp.toString()}`
}
```

**Unusual filter + period interaction:** when the "Unusual only" checkbox is active, the period filter is bypassed entirely — backdated entries can be anywhere in history:
```typescript
const from = unusualOnly ? null : periodFrom(period)
if (from) query = query.gte('performed_at', `${from}T00:00:00+05:00`)
```

---

## PWA Configuration

- `public/manifest.json` — app name "Hisaab", icons, `display: standalone`
- `app/layout.tsx` — Apple web app meta tags (`apple-mobile-web-app-title: "Hisaab"`)
- Installed PWA sends the same `User-Agent` as the underlying browser — device detection works correctly
- `no-scrollbar` utility class used for horizontal chip/filter rows (defined in global CSS)
