# Freyr v1 — Design

**Date:** 2026-07-18 (stack finalized same day: TypeScript/SvelteKit/SQLite after
Elixir/Phoenix and Go single-binary were dropped; feature design unchanged throughout)
**Status:** Approved
**Source:** `Finances v2.xlsx` (the manual spreadsheet this app replaces) + brainstorming session.

## 1. What we're building

Freyr replaces a 12-sheet personal-finance Excel workbook with a server-rendered SvelteKit
application. Decisions made during brainstorming:

| Decision | Choice |
|---|---|
| Core data model | **Transaction ledger** — individual transactions; all monthly/yearly/goal views derived |
| Historical data | **One-time seed import** from `Finances v2.xlsx` |
| Accounts | **No bank-account model.** Buckets only — but goals track *where* money is parked (see §3.3) |
| Build order | **Vertical phases** — each phase ships a usable slice and retires spreadsheet tabs |
| Currency | INR only. Money = integer paise; percentages = integer basis points |
| Users | Single user (created on first run), schema multi-user-ready |
| Packaging | **Portable code**: the app folder + `freyr.db` on any box with Node. No native binaries anywhere |

### What the spreadsheet contains (feature inventory)

| Sheet | Becomes |
|---|---|
| Budget | Salary projection planner + budget % splits |
| Monthly | Monthly budget dashboard (income → needs/wants/invest allocation vs. actual) |
| Yearly | Yearly rollup view (job vs. side-hustle income; estimate vs. actual per bucket) |
| Investments | SIP allocator (monthly amount split across funds) |
| Insurance | Insurance policy registry with premium history + renewal alerts |
| Tabs | Savings pots (short-term earmarked money) |
| Goals | Long-horizon goals with contribution history + placement breakdown |
| Lendings | Lending tracker with repayment schedule |
| Cards | Card benefits reference + reward-points tracker |
| Big Purchases | Purchase log with cost-per-year-of-use |
| Car Buying Guide | Car affordability calculator |
| Emergency Fund | Emergency-fund target calculator |

Pain points the design explicitly fixes:

- Manual adjustments buried in formulas (`=B4*C4-8022`) → become visible transactions with notes.
- "Accidentally overwrote 2025 Data" → derived values are **computed, never stored**; history is
  append-only transactions.
- Goal money placement ("is the Car money in FD or bank?") → first-class location breakdown.

## 2. Architecture

SvelteKit 2 (Svelte 5) with `adapter-node`. Domain logic in `src/lib/server/*` modules;
`+page.server.ts` thin (parse → domain → return/redirect). SQLite is the single source of
truth, accessed in-process via the Node stdlib `node:sqlite` (`DatabaseSync`). All money is
integer paise via `src/lib/money.ts` — never floats. All derived figures (rollups, progress,
principal left) are computed in SQL or pure functions at read time.

```
src/hooks.server.ts            — boot (db open + migrate), session → locals, auth guard
src/lib/money.ts               — paise: parse, arithmetic, Indian-grouped format; basis points
src/lib/server/db/             — open (WAL, foreign_keys, busy_timeout), migration runner
src/lib/server/auth.ts         — users, bcryptjs, cookie sessions
src/lib/server/ledger.ts       — transactions + rollups (the heart)
src/lib/server/budgets.ts      — budget % periods, salary projections
src/lib/server/goals.ts        — goals & pots, locations, contribution tracking
src/lib/server/registry.ts     — insurance, lendings, big purchases, cards
src/lib/server/backup.ts       — daily VACUUM INTO snapshots + retention
src/lib/server/importer/       — one-time Excel seed import (exceljs)
src/routes/                    — home, ledger, monthly, yearly, settings/budget, login, setup
scripts/import.ts              — CLI entry (npm run import -- "Finances v2.xlsx")
```

## 3. Data model

SQLite with `foreign_keys=ON`, WAL mode, `busy_timeout=5000`. Money columns are `INTEGER`
paise; percentage columns are `INTEGER` basis points (27.20% → 2720); dates are `TEXT`
ISO-8601 (`YYYY-MM-DD`).

### 3.1 Ledger

`transactions`
- `date`, `amount_paise` (> 0), `direction` (`income | outflow`)
- `bucket` (`needs | wants | investments`, NULL for income)
- `income_source` (`job | side_hustle | other`, NULL for outflows; `other` = lending repayments)
- `category_id` → `categories` (optional; seeded from Emergency Fund sheet: Grocery, Fuel,
  Fitness, Skincare, Clothing, Medicine, Bike EMI)
- `goal_id` (optional — marks a goal/pot contribution), `location_id` (required iff `goal_id`
  set), `lending_id` (optional — marks a repayment received)
- `note`, `imported` (0/1 — flags rows created by the Excel seed)
- CHECK constraints: amount positive; income ⇔ bucket NULL ∧ income_source NOT NULL;
  outflow ⇔ bucket NOT NULL ∧ income_source NULL; `(goal_id IS NULL) = (location_id IS NULL)`.

Everything that moves money is a transaction: salary in, expense out, goal contribution,
lending repayment received. Monthly/yearly views, goal progress, and lending principal-left are
all queries over this one table.

### 3.2 Budgets

`budget_periods` — `effective_from` (unique), `needs_bp`, `wants_bp`, `invest_bp` (basis
points; CHECK sum = 10000). The active period for a month is the latest `effective_from` ≤
that month. Captures the evolution 50/30/20 → 27/30/43.

`salary_projections` — planning-only rows: `year` (unique), `ending_salary_paise`,
`increment_bp` (nullable). Projected per-bucket amounts computed at render.

### 3.3 Goals (goals + pots unified)

The Excel's Goals (Car, Wedding, House) and Tabs (Bike, Car, Emergency Deposit, House) overlap;
one table with a `kind` covers both.

`goals` — `name` (unique), `kind` (`goal | pot`), `target_paise` (nullable for open-ended
pots), `status` (`active | complete | archived`), `planned_for` (text note).

`locations` — user-managed list of parking places: Bank, AU FD, Mutual Funds, Cash…
(`name`, unique).

`goal_moves` — `goal_id`, `from_location_id`, `to_location_id`, `amount_paise`, `date`,
`note`. Records shifting parked money (e.g. Bank → FD) without counting as a new contribution.
(Table lands in the schema now; UI in Phase 2.)

**Placement breakdown** (the "₹5L of Car is in FD" view) is computed per goal:
contributions grouped by location, plus/minus moves. Progress % = Σ contributions / target.
Quarterly contribution history = the same transactions grouped by quarter.

### 3.4 Registry

`insurance_policies` — `policy_type` (`mediclaim | term`), `person`, `policy_number`,
`activation_date`, `cover_paise`, `cover_post_ncb_paise` (nullable), `notes`.
`insurance_premiums` — `policy_id`, `year`, `amount_paise` (one row per year); unique
`(policy_id, year)`. Upcoming renewals (activation-date anniversaries within 60 days)
surface on the home dashboard (Phase 3).

`lendings` — `person`, `principal_paise`, `with_interest_paise` (nullable), `lent_on`
(nullable), `status` (`open | settled | written_off`), `notes`. Repayments are `transactions`
with `lending_id` set; principal left = principal − Σ repayments (computed).

`big_purchases` — `name`, `purchase_date`, `price_paise` (nullable — iPhone row has none),
`notes` (e.g. battery-limit regime). Years used and price-per-year computed at render.

`cards` — `name`, `annual_fee_paise` (nullable), `spend_benefit`, `tier1_merchants`,
`tier2_merchants`, `tier3_desc`, `caps`, `lounge_rule`, `exceptions`, `use_case`, `status`
(`active | closed`).
`card_rewards` — `card_id`, `merchant`, `reward_paise`, `points` (nullable), `period`
(nullable) — the Jupiter jewels tracker, generalized.

### 3.5 Tools (persisted inputs, computed outputs)

`sip_plans` + `sip_plan_funds` — total monthly amount; per-fund `name`, `cap_type`, `pct_bp`.
Rounded per-fund amounts (to the nearest ₹10) computed at render.

`emergency_fund_plans` (single row: `planned_months`) with many `emergency_fund_items`
(`name`, `monthly_paise`). Target = Σ items × months; one click updates the Emergency pot's
`target_paise`.

Car affordability calculator (Phase 4) — pure integer/fixed-point PMT implementation; inputs
kept in a `car_scenarios` table so scenarios can be saved and compared. Verdict rule:
EMI ≤ 10% of monthly salary.

## 4. UI

Per CLAUDE.md: super-compact, dense, no AI-slop. Server-rendered pages, one hand-written CSS
file (tight spacing scale, small controls, compact tables, right-aligned `tabular-nums`
figures, restrained palette, Lucide inline SVG icons, +/− color used sparingly). Forms POST
via SvelteKit actions with `use:enhance` — instant-feeling, no full reloads, still works
with JS disabled. Keyboard-first transaction entry (single row form, date defaulting to
today, focus returning to amount after save).

Navigation (left sidebar, dense):

- **Home** — current month at a glance: income so far, allocated vs. actual per bucket
  (computed from active budget period), goal progress strip; upcoming insurance renewals and
  open lendings total join in Phase 3.
- **Ledger** — filterable transaction table (month, bucket) + entry form.
- **Monthly / Yearly** — the Monthly and Yearly sheets as derived views.
- **Goals** — card-per-goal: progress, placement breakdown by location, quarterly history
  (Phase 2).
- **Registry** — Insurance / Lendings / Purchases / Cards as sub-tabs (Phase 3).
- **Planners** — Salary projection / SIP / Car / Emergency fund as sub-tabs (Phase 4).

Charts: none in Phase 1. If trends later warrant it, server-rendered inline SVG sparklines
(no chart library).

## 5. Excel seed import

A CLI script (`npm run import -- "Finances v2.xlsx"`) run once at setup:

- Parses the workbook with `exceljs` using raw cell values; a cell-helper module converts
  serial dates / decimal strings to dates / paise / basis points with integer math (no
  floats for money).
- **Monthly sheet** → per month: one job-income transaction (salary), per-bucket aggregate
  outflow transactions; formula adjustments (e.g. `−8022`) can't be recovered itemized, so each
  month's bucket actuals import as single aggregate transactions, `imported = 1`,
  note "Imported from Excel". `.` placeholder rows and rows whose note column says
  "Accidentally overwrote" are skipped — the clean duplicates at the sheet's bottom win.
  **Column-mapping note:** the workbook's Monthly headers label C `Wants` / E `Needs`, but the
  percentages prove the columns are swapped (C matches the Budget sheet's Needs ratio). Import
  maps C/D → needs, E/F → wants and prints this note for verification.
- **Yearly sheet** (2021–2023, pre-Monthly granularity) → aggregate income + bucket
  transactions per year, dated Dec 31, only for years with no monthly rows.
- **Budget sheet** → `budget_periods` derived from Monthly's distinct percentage triples;
  `salary_projections` rows from the Budget table.
- **Goals + Tabs** → `goals` rows; quarterly amounts become dated contribution transactions
  (quarter-end dates; "Pre-Q3 2024" → 2024-06-30) with location "Bank"; Tabs rows become pots
  (`target_paise` = amount, "Saved In" noted in `planned_for`). Car and House exist in both
  sheets — Goals wins; Tabs duplicates reported as skipped.
- **Lendings** → lending + monthly repayment transactions from the date columns; person rows
  without amounts reported as skipped.
- **Insurance** (cover columns are lakhs — ×1,00,000), **Big Purchases**, **Cards** (+ rewards
  block), **Investments** (SIP plan + funds), **Emergency Fund** (plan + items; item names
  seed `categories`) → straight rows into their tables.
- Import is idempotent-by-refusal: it aborts if any `imported = 1` transaction exists.
- After import, totals are printed for manual verification against the sheet (goal totals,
  lending principal left, budget period triples).

## 6. Phases

**Phase 0 — Foundation.** SvelteKit scaffold (TS, adapter-node, Vitest, Prettier/ESLint),
`src/lib/server/db` (SQLite, WAL, migrations), `src/lib/money.ts`, dense sidebar shell +
hand-written CSS, auth (first-run account creation, bcryptjs, session cookie), daily
`VACUUM INTO` backup with retention, CI (lint/check/test).

**Phase 1 — Ledger + Monthly budget + Import.** Retires: Monthly, Yearly, Budget-% columns.
Full schema (including later phases' tables so the import can land everything now); ledger
CRUD + validation; budget periods; Home, Ledger, Monthly, Yearly pages; the seed import.

**Phase 2 — Goals & pots.** Retires: Goals, Tabs, Emergency Fund. Goals pages, locations,
moves, placement breakdown, quarterly history; emergency-fund calculator wired to the
Emergency pot.

**Phase 3 — Registries.** Retires: Insurance, Lendings, Big Purchases, Cards. Registry pages;
renewal surfacing on Home; repayment entry from the lending page.

**Phase 4 — Planners.** Retires: Budget projection, Investments, Car Buying Guide. Salary
projection table, SIP allocator, car affordability calculator.

Each phase ends with: `npm run lint` + `npm run check` + `npm test` clean, action/load tests
for the new flows, README + ARCHITECTURE updated.

## 7. Testing

- Vitest unit tests for every derivation: money parse/format, monthly rollups, goal
  placement math, principal-left, basis-point allocation, SIP rounding, budget-period
  resolution.
- Server tests per page flow (call `load`/actions with a test DB: enter transaction, set
  budget period; later phases: contribute to goal, move between locations, record repayment).
- Import test against a fixture workbook (built in-test with exceljs) asserting totals match
  known values; the real-workbook run is verified manually against the sheet
  (e.g. Car accumulated = 5,69,600).
- SQLite CHECK constraints covered by tests that attempt invalid writes directly.

## 8. Out of scope for v1 (YAGNI)

- Bank feeds / statement import (CSV import can come later; ledger schema doesn't preclude it).
- Multi-currency, multi-user UI (schema-ready; no UI investment now).
- Investment *performance* tracking (NAV, XIRR) — the SIP allocator plans contributions only.
- Charts, PWA, Docker packaging.
- Notifications/emails for renewals — surfaced on Home only (Phase 3).
