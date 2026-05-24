@AGENTS.md

## Project documentation

Before working on this codebase, read:
- `docs/product.md` — what the app does, user roles, pages, business logic
- `docs/technical.md` — stack, schema, API patterns, auth, state management, migrations

## Quick orientation

- Primary workspace: `/home` — Supervisor Home; all supervisor finance tabs live in `HomeView.tsx`
- Owner module (sidebar-only): `/owner` (Owner Home — owners write their own `source='owner'` expenses) and `/joint` (Joint Home — view-only combined supervisor + owner spend, `components/CombinedReportView.tsx`)
- Sidebar is sectioned by role: Supervisor / Owner / Joint (see `Sidebar.tsx`)
- Admin (URL-only, not in nav): `/logs` (audit trail), `/visits` (page analytics)
- Legacy redirects: `/reports`, `/records`, `/expenses`, etc. → `/home`; `/reports/combined`, `/owner/report` → `/joint`
- Roles: **supervisor** writes all supervisor-managed data + admin pages; **owner** writes only their own owner-source expenses (`/owner`); **viewer** is read-only. New signups are viewers until promoted via Settings → App Users.
- Supervisor reads of `expenses` must filter `source='supervisor'` (Joint Home reads both)
- PKT (Asia/Karachi, UTC+5) is the project timezone — use it in all date formatting
