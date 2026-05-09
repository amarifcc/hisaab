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
| `/home` | Primary workspace — Overview, Expenses, Transfers, Deals tabs |
| `/settings/people` | Contacts management |
| `/settings/categories` | Expense category CRUD |
| `/settings/parts` | Project part CRUD |
| `/logs` | Write audit trail (supervisor only, URL-only) |
| `/visits` | Page visit analytics (supervisor only, URL-only) |

## Documentation

- `docs/product.md` — features, roles, pages, business logic
- `docs/technical.md` — schema, API patterns, migrations, gotchas
- `AGENTS.md` — rules and patterns for AI agents working on this codebase

## Migrations

Database migrations live in `supabase/migrations/`. Run them manually in the Supabase SQL Editor in order. See `docs/technical.md` for the full migration table.

## User roles

- **Supervisor** — full CRUD + admin pages
- **Viewer** — read-only

New signups default to `viewer`. Promote via:
```sql
UPDATE public.profiles SET role = 'supervisor' WHERE id = '<user-id>';
```
