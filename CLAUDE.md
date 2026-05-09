@AGENTS.md

## Project documentation

Before working on this codebase, read:
- `docs/product.md` — what the app does, user roles, pages, business logic
- `docs/technical.md` — stack, schema, API patterns, auth, state management, migrations

## Quick orientation

- Primary workspace: `/home` — all finance tabs live in `HomeView.tsx`
- Admin (URL-only, not in nav): `/logs` (audit trail), `/visits` (page analytics)
- All legacy routes (`/reports`, `/records`, `/expenses`, etc.) redirect to `/home`
- Supervisor role required for all mutations and admin pages
- PKT (Asia/Karachi, UTC+5) is the project timezone — use it in all date formatting
