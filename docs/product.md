# Hisaab — Product Reference

## What it is

Hisaab is a private PWA for tracking renovation project finances. It is used by a small group (2–4 people): one supervisor who manages all data entry, and one or more viewer accounts who can read but not write. The project is a home renovation spanning multiple physical parts (floors/sections).

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Supervisor** | Full CRUD on all data. The all-access superset. Sees Add buttons and edit/delete controls. Access to admin pages (`/logs`, `/visits`) and the Combined Report. |
| **Owner** | Logs in to a **standalone owner module** (`/owner`) and records expenses they paid **directly** (money that never passed through the supervisor), scoped to their own project part. Can add/edit/delete only their own owner-expenses. Cannot see or touch the supervisor workspace, transfers, deals, or settings. |
| **Viewer** | Read-only. Sees all supervisor data but no mutation controls. "Read only" badge shown on dashboard. |

Roles are stored in `profiles.role` (`supervisor`, `owner`, or `viewer`). Every new signup gets `viewer` by default (zero access until promoted). Promote/assign via **Settings → App Users** (supervisor only), which sets the role and, for owners, their `profiles.part_id`. Supervisor is the superset — to give one person both supervisor and owner powers, make them a supervisor.

There is no multi-role: `role` is a single field. The owner→part link lives on `profiles.part_id` (a DB CHECK enforces owner ⇒ part assigned). RLS scopes owner writes to `source='owner'` rows they created, pinned to their part.

---

## Project Parts

A **Project Part** represents a physical section of the renovation (e.g., Ground Floor, First Floor). Each part has:
- A name and short name (used as compact labels in chips)
- A color (used consistently across all views for visual grouping)
- A sort order

Everything financial — transfers, expenses, deals — belongs to one or more parts. The global **part filter** dropdown scopes all lists and summaries to that part.

---

## Core Data Entities

### Transfers
Money received by the supervisor from an owner for a specific part. The `part_id` is auto-resolved: when a transfer is recorded with a `from_person` name, the system looks up that person in the People list and uses their assigned project part. Owners must have a part assigned before transfers can be recorded for them.

### Expenses
Money spent on the renovation. An expense has a total amount, a category, an optional `paid_to` (contractor/supplier name), and is allocated to one or more parts via `expense_allocations`. A multi-part purchase is shown as linked per-part rows with the same reference number.

Every expense carries a `source`: `'supervisor'` (the default — money managed by the supervisor) or `'owner'` (money an owner paid directly). The supervisor workspace (`/home`, cashbook, deal paid-totals) only ever reads `source='supervisor'`; owner-source expenses live in the owner module and only surface together in the Combined Report. Owner expenses are always single-part (pinned to the owner's part).

### Deals
Agreed contracts with contractors. A deal records a piece of work and its revision history. The first revision is the original agreed scope; later revisions add or reduce scope with positive/negative amount deltas. Payments are computed from `expenses.paid_to` matching the deal's `person_name` for the relevant part, so paid/remaining is shown at contractor+part level.

### People
A contacts list used for autocomplete on `from_person` (transfers) and `paid_to` (expenses). Person types: `owner`, `contractor`, `employee`, `supplier`. Owners must have a `part_id` assigned — this is how transfers auto-resolve their part.

---

## Pages

### Home (`/home`)
The primary workspace. Contains four tabs sharing a global part filter:

| Tab | Content |
|-----|---------|
| **Overview** | Balance, received/spent metrics, activity counts, top-spend part, part cards. Single-part: colored balance card + category breakdown. |
| **Expenses** | Sub-views: Category (spending breakdown with progress bars), Person (grouped by `paid_to`), List (flat sortable/searchable transaction list with edit/delete). |
| **Transfers** | Sortable/searchable list of all transfers. Edit and delete inline. |
| **Deals** | Per-contractor: agreed / paid / remaining. Expanded cards show contractor+part groups, individual deals, and revision timelines. |

All legacy routes (`/reports`, `/expenses`, `/transfers`, `/deals`, `/records`, `/transactions`) redirect to `/home`.

Part filter persists in `localStorage` under `hisab_reports_filter_part`.

### Settings — People (`/settings/people`)
Manage the contacts list. Adding an owner requires selecting their project part. Person cards show type badge and (for owners) their assigned part chip.

### Settings — Categories (`/settings/categories`)
Category CRUD (supervisor only). Supports parent/child hierarchy and group flags.

### Settings — Parts (`/settings/parts`)
Project part CRUD (supervisor only). Name, short name, color, sort order.

### Settings — App Users (`/settings/users`)
Supervisor-only. Lists all login accounts (`profiles`) with their role and (for owners) assigned part. Lets the supervisor promote a viewer to **owner** + assign a project part, or demote back. A supervisor cannot change their own role (prevents lock-out). Owners must sign up first (they start as viewers with no access), then get promoted here.

---

## Owner Module (`/owner`) — Owner role only

A standalone shell, separate from the supervisor workspace. An owner sees only their own part. It does **not** show the supervisor bottom nav/sidebar.

| Page | Content |
|------|---------|
| **My Expenses** (`/owner`) | Total direct spend for the owner's part + list of their owner-source expenses, with add (FAB) / edit / delete. Add/edit uses the shared `ExpenseSheet` locked to the owner's part (no split, no deal context). |
| **Report** (`/owner/report`) | Combined Report scoped to the owner's part: supervisor + owner spend with a source split and category breakdown. |

The owner is auto-redirected here on login; they cannot load `/home` or any supervisor/settings page.

---

## Combined Report (`/reports/combined`) — Supervisor

Standalone merged report (linked from the sidebar). Per project part: total spend = supervisor + owner, shown with a supervisor-vs-owner split bar and a category breakdown. Supervisor sees all parts; the owner-module version (`/owner/report`) shows only the owner's part. Does not touch or alter `/home`.

---

## Admin Pages (Supervisor Only, Not in Navigation)

These pages are accessible by URL only — they do not appear in the bottom nav or sidebar. Only supervisors can view them. Viewers get an "access required" message.

### Write Logs (`/logs`)
Full audit trail of all CREATE, UPDATE, DELETE operations across the app.

**Features:**
- Period filter pills: Today / Week (default) / Month / All time
- Filters: action type, entity type, user, free-text search
- **Unusual only** checkbox: flags entries where `entity_date` is more than 48 hours before `performed_at` (i.e., a backdated transaction was added or edited late). Works on expenses, transfers, and deals.
- Summary metrics: Total / New / Edited / Deleted counts
- Per-row: action badge, entity type, unusual badge (⚠️ backdated), who logged it, when, summary text
- UPDATE entries show a readable field diff (old → new) before the raw JSON toggle
- 300-row cap with warning banner

**Unusual flag logic:** `(performed_at − entity_date) > 48 hours`. Only applies to CREATE and UPDATE actions on expense, transfer, and deal entities. Entries without `entity_date` are never flagged.

### Page Visits (`/visits`)
Analytics view of all page views tracked across the app.

**Features:**
- Period filter pills: Today / Week (default) / Month / All time (inside filter card)
- Filters: user, page path
- Summary metrics: total visits, unique users, top page
- Rows grouped by PKT date (Today / Yesterday / date label)
- Per-row: path, time (PKT), user name, device (brand + model), country flag + name
- Query params hidden by default — expand "params" to see them (translated: UUID → name)
- 300-row cap with warning banner

**Device detection:** parsed from `user_agent` string. Android: extracts brand (Samsung, Google, Xiaomi, OnePlus, etc.) + model from Build string. iOS: iPhone / iPad. Desktop: Windows / Mac / Linux. Smartphone icon is blue; Monitor icon is grey.

**Country detection:** uses `x-vercel-ip-country` header — only populated in Vercel production, always null on localhost.

---

## Key Business Logic

**Deal "paid" amount:** No payments table. The amount paid against deals is the sum of all expenses where `paid_to = deal.person_name` for the relevant part(s). Adding an expense with the correct `paid_to` automatically updates the contractor+part paid/remaining display.

**Transfer part auto-resolution:** The transfer form only asks "from whom". The API looks up that person in `people` where `person_type = 'owner'` and uses their `part_id`. If the owner has no part assigned, the API returns a 400 with an actionable error message pointing to Settings → People.

**Expense allocations:** A single expense can be allocated across multiple parts. The `expense_allocations` table stores per-part amounts. Multi-part expenses appear as linked rows per part using the same reference number. When a part filter is active, only that part's allocation amount is shown.

**Backdated entry detection:** `activity_logs.entity_date` stores the transaction's own date (the date field on the expense/transfer/deal). At log time, this is compared to `performed_at`. If the gap exceeds 48 hours, the log is flagged as unusual. This catches cases where someone records a March expense in May. The `entity_date` column was backfilled for historical logs via SQL (UPDATE from `changes` JSON for UPDATEs, JOIN with entity tables for CREATEs).

**Page visit tracking:** `PageVisitTracker` (client component) fires a POST to `/api/page-visits` on every navigation. It requires a `<Suspense>` boundary in the layout because it uses `useSearchParams()`. Without the boundary, the component doesn't mount properly in Next.js 14+ and visits are never recorded.
