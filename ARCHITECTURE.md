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
src/hooks.server.ts            — boot: open+migrate db once, rebuild the budget_periods
                                 projection, session cookie → locals.user, auth guard
                                 (no users → /setup, unauthenticated → /login),
                                 theme cookie → <html data-theme> via transformPageChunk,
                                 hourly backup timer
src/app.css                    — the whole stylesheet: design tokens (both themes),
                                 shell, tables, forms, responsive rules. Implements DESIGN.md
src/lib/money.ts               — integer-paise money: parse ("1,23,456.78" → paise),
                                 Indian-grouped format, basis-point math (mulBP)
src/lib/dates.ts               — YYYY-MM-DD string helpers (no Date-object state)
src/lib/format.ts              — figure presentation: formatCell (zero → em dash, inflows
                                 signed) and delta (arrow = direction, class = good news)
src/lib/progress.ts            — meter thresholds (brand <80%, amber 80–100%, loss >100%)
                                 and, over the cap, the rescaled fill + excess widths
src/lib/components/            — FreyrMark (the logo, traced vector), Icon (Lucide subset,
                                 inline paths), ThemeToggle (form action, no client state),
                                 Money/Delta/Meter (one figure each, rules from format.ts
                                 and progress.ts), EntryBar (the add form, shared by
                                 /ledger and home)
src/lib/server/db/             — open (WAL, busy_timeout, foreign_keys), migration runner,
                                 SQLITE_CONSTRAINT_UNIQUE; migrations bundled via Vite
                                 ?raw glob (fs fallback for tsx)
src/lib/server/auth.ts         — users (bcryptjs), sessions (sha256 token at rest, 90d)
src/lib/server/ledger.ts       — transactions CRUD + validation, categories,
                                 monthly/yearly rollups (conditional aggregation, one query)
src/lib/server/budgets.ts      — budget periods (basis points), activeFor/periodFor,
                                 allocate, monthSummary and yearlyAllocation
                                 (allocated/actual/remaining per bucket)
src/lib/server/budget-policy.ts — the base and raise splits, and the closed form a raise
                                 history folds to: share = marginal + (base − marginal) / F
src/lib/server/promotions.ts   — the promotion log, and the projection of budget_periods
                                 from policy + log (rebuilt whole on every write)
src/lib/server/goals.ts        — goals & pots, locations, goalProgress (grouped, no N+1)
src/lib/server/comparison.ts   — prior-period fold: same span of days when in progress, whole
                                 once complete — shared by home, monthly and yearly
src/lib/server/txn-form.ts     — form values → transaction; shared create-action wrapper and
                                 EntryBar's options, so neither can drift by page
src/lib/server/registry.ts     — lendings + openLendingsTotal; insert helpers for
                                 insurance/purchases/cards/SIP/emergency (import targets)
src/lib/server/backup.ts       — daily VACUUM INTO backups/freyr-YYYY-MM-DD.db, keep 30
src/lib/server/importer/       — one-time Excel seed import (exceljs), per-sheet modules,
                                 single transaction, idempotent-by-refusal
src/routes/                    — thin +page.server.ts (parse → domain → return/redirect):
                                 / (home), /ledger, /monthly, /yearly, /settings/budget,
                                 /login, /setup, /logout, /theme (POST: set cookie, bounce back)
scripts/import.ts              — CLI import entry (tsx) with verification report
scripts/dump-workbook.ts       — dev utility: dump an xlsx's raw cell layout
```

## Data model

SQLite, three migrations (`0001_auth`, `0002_domain`, `0003_promotions`). Money columns are
`INTEGER` paise; percentages `INTEGER` basis points (27.20% → 2720); dates `TEXT` ISO-8601.

- **transactions** — the heart. Every money movement is one row: salary in, expense out,
  goal contribution (goal + location set), lending repayment received (`income`/`other` +
  lending id). CHECK constraints enforce: amount > 0; income ⇔ no bucket ∧ has source;
  outflow ⇔ has bucket ∧ no source; goal and location together or not at all. All views
  derive from this table.
- **budget_policy / promotions** — the source of truth for the splits. One policy row (base
  triple + raise triple + a base effective date) and one row per raise (date, increment in
  bp, note; `UNIQUE(effective_date)`).
- **budget_periods** — bp triple per effective date, CHECK sum = 10000; the active period
  for a month is the latest `effective_from` ≤ that month. **Not a plain table — a
  projection**: rows carry `source` (`base` / `promotion` / `manual`), and every write to
  the policy or the log deletes and rewrites all `base`/`promotion` rows from the fold.
  `manual` rows are user-owned, never reprojected, and outrank a generated row on the same
  date (`UNIQUE(effective_from, source)`), so a hand-typed correction to one month survives
  any number of rebuilds.
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
errors return `fail(400, { error, values })` so the form re-renders with what was typed. Every
form renders that message below its own controls as a `role="alert"` — `use:enhance` never
reloads, so an unannounced message would be silent — and where focus returns to a control
(the entry bar's amount field), that control points at it with `aria-describedby`. Pages with
several forms tag the failure (`failed: 'addPromotion'`) so only the one that failed
re-renders it.

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
- **Only the income sources the rollups count are offered.** `monthlyActuals` and the
  yearly split aggregate `job` and `side_hustle`, so the entry bar offers those two alone;
  income booked as `other` would be invisible to every allocation and total. The enum keeps
  `other` for imported rows (lending repayments received).
- **Imported history double-counts goal contributions inside monthly invest actuals** —
  the workbook itself couldn't be reconciled itemized; flagged in the import report and
  accepted for pre-app history.
- **Budget periods are a projection, not an editable table.** The user maintains a raise
  policy and a promotion log; `promotions.ts` folds them into `budget_periods` and every
  read path (`activeFor`, `periodFor`, both rollups) keeps querying that one table
  unchanged. The fold is a closed form in the cumulative growth factor, so replaying a
  career of raises cannot drift. Trade-off: the projection is derived state in the database,
  which must be rebuilt whenever its inputs change — including for a database whose inputs
  have never changed. `hooks.server.ts` therefore rebuilds it once at boot: a fresh or
  freshly-migrated file otherwise carried a policy no page could see, and `/monthly`
  reported no period covering a month the policy did describe. The rebuild rewrites only the
  rows it owns, so it is idempotent and never touches a manual correction.
- **One extended result code is named, not matched by message.**
  `SQLITE_CONSTRAINT_UNIQUE` (2067) lives in `src/lib/server/db/index.ts`; `budgets.ts` and
  `promotions.ts` catch it on `errcode` to turn a duplicate date into a sentence a form can
  show, keeping raw "UNIQUE constraint failed: …" text as the error's `cause`. Matching on
  the message string would break on a SQLite upgrade.
- **Presentation rules live in pure functions, not in components.** `format.ts` (zero → em
  dash, inflow sign, delta arrow vs colour) and `progress.ts` (meter thresholds and widths)
  hold the rules; `Money`/`Delta`/`Meter` only render them. The reason is the test setup:
  `vite.config.ts` defines a single `node` project that excludes `*.svelte.spec.ts`, so
  there is no component environment and a pure function is the only layer a test can reach.
  Rules that had been re-derived per page are what shipped `₹0.00` to the yearly page.
- **Sessions store sha256(token), never the token.** Cookie is HttpOnly + SameSite=Lax;
  CSRF via SvelteKit's built-in origin check.
- **Theme is a cookie resolved on the server, not client state.** `hooks.server.ts` reads
  `freyr_theme` and stamps `data-theme` onto `<html>` through `transformPageChunk`, so the
  correct theme is in the first byte — no flash, no blocking inline script. The toggle is a
  form action (`POST /theme`), so it works with JavaScript off. No cookie means no attribute,
  and `prefers-color-scheme` decides. `/theme` is exempt from both auth redirects so the
  toggle also works on the login and setup screens.
- **One stylesheet, no component library, no CSS build step.** Tokens are plain custom
  properties; the dark theme re-declares them under `[data-theme='dark']` and again inside a
  `prefers-color-scheme` block for the no-cookie case. The duplication is deliberate — the
  alternative is a class-swap that flashes or a build step the stack rules out.
- **Tables reflow to cards on phones with the same markup.** `data-label` attributes drive
  `::before` labels below 40rem; cells whose value is absent omit the attribute and are
  hidden, so there is no second mobile template to keep in sync. The cost is that "no
  attribute" means "no value": a cell that is not a labelled field needs an explicit
  carve-out, which is why `td.empty` (the empty-state line) is excluded by name rather than
  given a label it should not print.
- **Design decisions live in [DESIGN.md](DESIGN.md)**, which is the target `src/app.css`
  implements. Colour choices there are contrast-verified rather than asserted.

_Add an entry here whenever a significant architectural decision is made._
