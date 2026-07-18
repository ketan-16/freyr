# Architecture

How Freyr is built. Updated as the system evolves — this reflects the _current_ design, not the
original plan.

## Overview

A SvelteKit 2 app (server-rendered, progressive enhancement via form actions +
`use:enhance`) on Node.js, with SQLite (`node:sqlite`, in-process) as the single source of
truth. Everything derived — rollups, goal progress, principal left — is computed at read
time, never stored. See [STACK.md](STACK.md) for technology choices and rationale.

## Modules

```
src/hooks.server.ts            — boot: open+migrate db once, session cookie → locals.user,
                                 auth guard (no users → /setup, unauthenticated → /login),
                                 hourly backup timer
src/lib/money.ts               — integer-paise money: parse ("1,23,456.78" → paise),
                                 Indian-grouped format, basis-point math (mulBP)
src/lib/dates.ts               — YYYY-MM-DD string helpers (no Date-object state)
src/lib/server/db/             — open (WAL, busy_timeout, foreign_keys), migration runner;
                                 migrations bundled via Vite ?raw glob (fs fallback for tsx)
src/lib/server/auth.ts         — users (bcryptjs), sessions (sha256 token at rest, 90d)
src/lib/server/ledger.ts       — transactions CRUD + validation, categories,
                                 monthly/yearly rollups (conditional aggregation, one query)
src/lib/server/budgets.ts      — budget periods (basis points), activeFor, allocate,
                                 monthSummary (allocated/actual/remaining per bucket)
src/lib/server/goals.ts        — goals & pots, locations, goalProgress (grouped, no N+1)
src/lib/server/registry.ts     — lendings + openLendingsTotal; insert helpers for
                                 insurance/purchases/cards/SIP/emergency (import targets)
src/lib/server/backup.ts       — daily VACUUM INTO backups/freyr-YYYY-MM-DD.db, keep 30
src/lib/server/importer/       — one-time Excel seed import (exceljs), per-sheet modules,
                                 single transaction, idempotent-by-refusal
src/routes/                    — thin +page.server.ts (parse → domain → return/redirect):
                                 / (home), /ledger, /monthly, /yearly, /settings/budget,
                                 /login, /setup, /logout
scripts/import.ts              — CLI import entry (tsx) with verification report
scripts/dump-workbook.ts       — dev utility: dump an xlsx's raw cell layout
```

## Data model

SQLite, two migrations (`0001_auth`, `0002_domain`). Money columns are `INTEGER` paise;
percentages `INTEGER` basis points (27.20% → 2720); dates `TEXT` ISO-8601.

- **transactions** — the heart. Every money movement is one row: salary in, expense out,
  goal contribution (goal + location set), lending repayment received (`income`/`other` +
  lending id). CHECK constraints enforce: amount > 0; income ⇔ no bucket ∧ has source;
  outflow ⇔ has bucket ∧ no source; goal and location together or not at all. All views
  derive from this table.
- **budget_periods** — bp triple per effective date, CHECK sum = 10000; the active period
  for a month is the latest `effective_from` ≤ that month.
- **goals / locations / goal_moves** — goals and pots unified by `kind`; placement tracked
  by location-tagged contributions (moves UI lands in Phase 2).
- **lendings, insurance_policies(+premiums), big_purchases, cards(+rewards), sip_plans
  (+funds), emergency_fund_plans(+items), salary_projections** — registry/planner tables,
  populated by the import now, UI in Phases 2–4.

## Data flow

Request → `hooks.server.ts` (db + session + guard) → `load`/action in `+page.server.ts`
(thin) → `src/lib/server/*` domain function (validation + hand-written SQL) → rendered
page. Forms POST to named actions and redirect (303) preserving filters; `use:enhance`
makes that feel instant and refocuses the amount field for keyboard-first entry. Validation
errors return `fail(400, { error, values })` so the form re-renders with what was typed.

## Excel import design

`runImport` reads the workbook with exceljs and lands everything in one SQLite
transaction; it refuses to run if imported rows already exist. Notable decisions, derived
from a raw dump of the real workbook:

- The Monthly sheet's C/E headers are swapped relative to their percentages — C/D hold
  needs, E/F wants. Verified against the Budget sheet's ratios; imported swapped, noted in
  the report.
- Rows noted "Accidentally overwrote 2025 Data" are skipped (their clean duplicates at the
  sheet bottom win); `.` placeholder rows are skipped.
- Monthly bucket actuals import as single aggregate transactions per month (the workbook's
  formula adjustments can't be recovered itemized); budget periods derive from the distinct
  ratio triples.
- Goal quarterly history becomes dated contribution transactions (quarter-end dates,
  "Pre-Q3 2024" → 2024-06-30) at location Bank; Tabs become pots with an opening
  contribution at their "Saved In" location; Car/House exist in both sheets — Goals wins.
- Insurance covers are lakhs (×1,00,000). Emergency-fund item names seed ledger categories.
- Cell floats are converted to paise via their 2-decimal string form — float arithmetic
  never touches money.

## Key decisions & trade-offs

- **Portable code over compiled binaries.** TypeScript on Node, SQLite from the Node
  stdlib. Prior stacks (Elixir/Phoenix/Postgres, then a Go single binary) were dropped for
  toolchain footprint and system-dependent binaries.
- **Transaction ledger over stored aggregates.** The workbook's "accidentally overwrote"
  pain point disappears: history is append-only, every view is a query.
- **Money is integer paise; percentages are basis points.** Enforced in domain code and by
  SQLite CHECK constraints; division goes through explicit rounding (`mulBP`, half away
  from zero).
- **Imported history double-counts goal contributions inside monthly invest actuals** —
  the workbook itself couldn't be reconciled itemized; flagged in the import report and
  accepted for pre-app history.
- **Sessions store sha256(token), never the token.** Cookie is HttpOnly + SameSite=Lax;
  CSRF via SvelteKit's built-in origin check.

_Add an entry here whenever a significant architectural decision is made._
