# Hisaab — Product Reference

## What it is

Hisaab is a private PWA for tracking renovation project finances. It is used by a small group (2–4 people): one supervisor who manages all data entry, and one or more viewer accounts who can read but not write. The project is a home renovation spanning multiple physical parts (floors/sections) over roughly 3 months.

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Supervisor** | Full CRUD on all data. Sees Add buttons and edit/delete controls. |
| **Viewer** | Read-only. Sees all data but no mutation controls. "Read only" badge shown on dashboard. |

Roles are stored in `profiles.role` (`supervisor` or `viewer`). Every new signup gets `viewer` by default. To promote to supervisor, run `UPDATE public.profiles SET role = 'supervisor' WHERE id = '<user-id>';` in Supabase SQL Editor.

---

## Project Parts

A **Project Part** represents a physical section of the renovation (e.g., Ground Floor, First Floor). Each part has:
- A name and short name (used as compact labels in chips)
- A color (used consistently across all views for visual grouping)
- A sort order

Everything financial — transfers, expenses, deals — belongs to one or more parts. The global **part filter** dropdown (top-right on every page) scopes all lists and summaries to that part.

---

## Core Data Entities

### Transfers
Money received by the supervisor from an owner for a specific part. The `part_id` is auto-resolved: when a transfer is recorded with a `from_person` name, the system looks up that person in the People list and uses their assigned project part. Owners must have a part assigned before transfers can be recorded for them.

### Expenses
Money spent on the renovation. An expense has a total amount, a category, an optional `paid_to` (contractor/supplier name), and is allocated to one or more parts via `expense_allocations`. A multi-part purchase is shown as linked per-part rows with the same reference number.

### Deals
Agreed contracts with contractors. A deal records a piece of work and its revision history. The first revision is the original agreed scope; later revisions add or reduce scope with positive/negative amount deltas. Payments are still computed from `expenses.paid_to` matching the deal's `person_name` for the relevant part, so paid/remaining is shown at contractor+part level rather than per individual deal.

### People
A contacts list used for autocomplete on `from_person` (transfers) and `paid_to` (expenses). Person types: `owner`, `contractor`, `employee`, `supplier`. Owners must have a `part_id` assigned — this is how transfers auto-resolve their part.

---

## Pages

### Records
Combined workspace for transactions and deals. The Transactions tab shows transfers and expenses with search by reference, name, description, or notes. The Deals tab shows contractor+part deal groups with contractor filtering. Each tab keeps the relevant Add action.

### Transfers
List of money received per owner per part. Sorted by date. Part filter persists in localStorage.

### Expenses
List of expenses with category filter tabs. Part filter persists in localStorage.

### Deals
Available inside Records. Contractor deals are grouped by contractor+part. Summary cards show group agreed, paid, remaining, with individual deals and revision timelines underneath. Part and contractor filters help narrow the list.

### Reports
Four tabs sharing a global part filter dropdown:

| Tab | Content |
|-----|---------|
| **Overview** | All-parts: balance, received/spent metrics, activity counts, top-spend part, and part cards. One part: colored balance card + category spending breakdown |
| **Expenses** | Spending breakdown by category with progress bars. Multi-select to filter categories → flat transaction list. |
| **People** | Expenses grouped by `paid_to`. Multi-select to filter contractors → flat transaction list. |
| **Deals** | Per-contractor: agreed / paid / remaining. Expanded cards show contractor+part groups, individual deals, and revision timelines. |

Share button captures the report as PNG and invokes the native share sheet (Android) or downloads on desktop.

### Settings — People
Manage the contacts list. Adding an owner requires selecting their project part. Person cards show type badge and (for owners) their assigned part chip.

### Settings — Categories & Parts
Basic CRUD for expense categories and project parts (supervisor only).

---

## Key Business Logic

**Deal "paid" amount**: There is no payments table. The amount paid against deals is the sum of all expenses where `paid_to = deal.person_name` for the relevant part(s). This means adding an expense with the correct `paid_to` automatically updates the contractor+part paid/remaining display. Individual deals do not have separate paid balances unless future expense-to-deal linking is added.

**Transfer part auto-resolution**: The transfer form only asks "from whom". The API looks up that person in `people` where `person_type = 'owner'` and uses their `part_id`. If the owner has no part assigned, the API returns a 400 with an actionable error message pointing to Settings → People.

**Expense allocations**: A single expense can be allocated across multiple parts. The `expense_allocations` table stores the per-part amounts. In transaction/expense lists, multi-part expenses appear as linked rows per part using the same reference number. When a part filter is active, only that part's allocation amount is shown, not the total.

**Part filter persistence**: Each page saves its active part filter in localStorage under a page-specific key (`hisab_transactions_filter_part`, `hisab_expenses_filter_part`, `hisab_deals_filter_part`, `hisab_transfers_filter_part`, `hisab_reports_filter_part`).
