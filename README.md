# Hisaab

Private PWA for tracking renovation project finances. Built for a small team (2–4 people) managing expenses, transfers, and contractor deals across multiple physical sections of a home renovation.

## Stack

- **Framework:** Next.js 16 App Router
- **Database:** Supabase (Postgres + Auth + RLS)
- **Styling:** Tailwind CSS v4
- **Deployment:** Vercel

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key pages

| Route | Description |
|-------|-------------|
| `/home` | Supervisor Home — Overview, Expenses, Transfers, Deals tabs (all roles read; supervisor writes) |
| `/owner` | Owner Home — owner-direct expense tracking for the owner's part (owner role only) |
| `/joint` | Joint Home — view-only combined supervisor + owner spend (supervisor + owner) |
| `/cashbook` | Daily cash ledger (opening / in / out / closing) |
| `/settings/people` | Contacts management |
| `/settings/categories` | Expense category CRUD |
| `/settings/parts` | Project part CRUD |
| `/settings/users` | App Users — promote a viewer to owner + assign a part (supervisor only) |
| `/logs` | Write audit trail (supervisor only, URL-only) |
| `/visits` | Page visit analytics (supervisor only, URL-only) |

## Documentation

- `docs/product.md` — features, roles, pages, business logic
- `docs/technical.md` — schema, API patterns, migrations, gotchas
- `AGENTS.md` — rules and patterns for AI agents working on this codebase

## Migrations

Database migrations live in `supabase/migrations/`. Run them manually in the Supabase SQL Editor in order. See `docs/technical.md` for the full migration table.

## User roles

- **Supervisor** — full CRUD on supervisor-managed data + admin pages. The all-access superset.
- **Owner** — read-only on the supervisor app (Home, Cashbook) + writes their own direct expenses for their assigned part (Owner Home). Sees Joint Home.
- **Viewer** — read-only.

New signups default to `viewer` (zero access until promoted). Promote via **Settings → App Users** (supervisor only) — owners must also be assigned a project part. Or by SQL:
```sql
-- supervisor
UPDATE public.profiles SET role = 'supervisor' WHERE id = '<user-id>';
-- owner (part_id required)
UPDATE public.profiles SET role = 'owner', part_id = '<part-id>' WHERE id = '<user-id>';
```
