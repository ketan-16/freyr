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
                                 replayed writes applied once (x-freyr-key), hourly
                                 backup timer
src/service-worker.ts          — offline: precaches the release's files, keeps pages and
                                 their data network-first, queues writes in IndexedDB and
                                 replays them in order (see Offline, below)
src/app.css                    — the whole stylesheet: tokens (both themes), shell, page
                                 header, 12-column grid (container queries), panels, controls,
                                 tables, the chart system, dialogs, responsive rules.
                                 Implements DESIGN.md
src/lib/money.ts               — integer-paise money: parse ("1,23,456.78" → paise),
                                 Indian-grouped format, basis-point math (mulBP),
                                 toAmountInput (paise → the plain decimal a field posts back),
                                 and the phone keypad: keyAmount (one press, operators
                                 included) and evaluateAmount (a sum → paise, exact BigInt
                                 fractions, one rounding)
src/lib/offline.ts             — what the worker, the page and the server share: queued-write
                                 types, the data-cache key and skip-node merge, judging a
                                 replay's answer, a queued write described in words
src/lib/theme.ts               — the theme setting's three values (system/light/dark)
src/lib/dates.ts               — YYYY-MM-DD string helpers (no Date-object state), display
                                 labels (monthLabel, shortDate, dayLabel, shortMonth), weekday,
                                 addMonths
src/lib/format.ts              — figure presentation: formatCell (zero → em dash, inflows
                                 signed), delta (arrow = direction, class = good news),
                                 formatCompact (₹9.5K / ₹1.2L / ₹1.5Cr), share (whole percent)
src/lib/progress.ts            — meter thresholds and, over the cap, the rescaled fill + excess
src/lib/chart.ts               — chart geometry, pure: niceScale (1/2/2.5/5 ticks), pct,
                                 cumulative, linePath/areaPath in a 0–100 viewBox
src/lib/ui.svelte.ts           — the shell's client state (sheet, command menu, toasts, theme
                                 setting) as a class with $state fields, provided per app
                                 through context; isTyping / wantsNewTab / anchorPopover
src/lib/sync.svelte.ts         — the page's side of offline: the worker's status (reachable,
                                 waiting, refused) as $state, and the nudges that drain the
                                 queue where Background Sync is missing (online, foreground)
src/lib/components/            — shell: PageHeader, Stepper (+ MonthNav), TxnSheet, TxnForm,
                                 CommandMenu, EntryBar, ThemeSwitch (+ ThemeToggle, its
                                 sidebar menu), SyncStatus, FreyrMark, Icon (Lucide paths);
                                 figures: Money, Delta, Kpi, Bullet, ShareBar, Notice;
                                 charts: PaceChart, DailyChart, MonthChart, SplitChart,
                                 Sparkline, Ranks
src/lib/server/db/             — open (WAL, busy_timeout, foreign_keys), migration runner,
                                 SQLITE_CONSTRAINT_UNIQUE; migrations bundled via Vite
                                 ?raw glob (fs fallback for tsx)
src/lib/server/auth.ts         — users (bcryptjs), sessions (sha256 token at rest, 90d)
src/lib/server/replay.ts       — at-most-once for writes the worker may send twice: an
                                 in-memory, bounded map of key → first answer
src/lib/server/ledger.ts       — transactions: create, get, update (form-owned fields only),
                                 delete, list; monthly/yearly rollups (conditional
                                 aggregation, one query)
src/lib/server/insights.ts     — read-only chart data: dailyTotals, monthlyTotals over any
                                 range, outflowByCategory — one grouped query each
src/lib/server/categories.ts   — categories scoped to a bucket or an income source:
                                 list/create/rename/archive/delete, usage counts
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
src/lib/server/txn-form.ts     — form values → transaction, for create and update alike;
                                 the shared create/update actions and the entry options
src/lib/server/registry.ts     — lendings + openLendingsTotal; insert helpers for
                                 insurance/purchases/cards/SIP/emergency (import targets)
src/lib/server/backup.ts       — daily VACUUM INTO backups/freyr-YYYY-MM-DD.db, keep 30
src/lib/server/importer/       — one-time Excel seed import (exceljs), per-sheet modules,
                                 single transaction, idempotent-by-refusal
src/routes/                    — thin +page.server.ts (parse → domain → return/redirect):
                                 / (home), /ledger, /ledger/[id] (edit + delete), /monthly,
                                 /yearly, /settings (hub), /settings/budget,
                                 /settings/categories, /login, /setup, /logout,
                                 /theme (POST: set or clear the cookie, bounce back);
                                 +error.svelte (503 is the worker's "not saved offline")
static/                        — favicon, the web app manifest and its icons (from FreyrMark)
scripts/import.ts              — CLI import entry (tsx) with verification report
scripts/dump-workbook.ts       — dev utility: dump an xlsx's raw cell layout
```

## Data model

SQLite, four migrations (`0001_auth`, `0002_domain`, `0003_promotions`, `0004_categories`).
Money columns are
`INTEGER` paise; percentages `INTEGER` basis points (27.20% → 2720); dates `TEXT` ISO-8601.

- **transactions** — the heart. Every money movement is one row: salary in, expense out,
  goal contribution (goal + location set), lending repayment received (`income`/`other` +
  lending id). CHECK constraints enforce: amount > 0; income ⇔ no bucket ∧ has source;
  outflow ⇔ has bucket ∧ no source; goal and location together or not at all. All views
  derive from this table.
- **categories** — every transaction is filed under one, and each category belongs to one
  `scope`: a bucket (`needs`/`wants`/`investments`) for outflows, or an income source
  (`job`/`side_hustle`/`other`) for income. `UNIQUE(scope, name)`, so "Travel" can exist
  under both Needs and Wants. That a row's category matches its own bucket or source is the
  one invariant no CHECK can hold — it spans two tables — so `txn-form.ts` enforces it, and
  nothing else writes `category_id`. Categories are archived rather than deleted once used:
  `category_id` is `ON DELETE SET NULL`, so a delete would strip the label off history; the
  domain refuses it and settings only offers delete at zero usage.
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
  by location-tagged contributions. Only the import writes them: the entry bar dropped its
  goal and location fields when the ledger became daily-entry-first, so goal progress
  reflects imported history until a goals UI lands (Phase 2).
- **lendings, insurance_policies(+premiums), big_purchases, cards(+rewards), sip_plans
  (+funds), emergency_fund_plans(+items), salary_projections** — registry/planner tables,
  populated by the import now, UI in Phases 2–4.

## Data flow

Request → `hooks.server.ts` (db + session + guard) → `load`/action in `+page.server.ts`
(thin) → `src/lib/server/*` domain function (validation + hand-written SQL) → rendered
page. Forms POST to named actions and redirect (303) preserving filters; `use:enhance`
makes that feel instant. Validation errors return `fail(400, { error, values })` so the form
re-renders with what was typed, under its own controls, as a `role="alert"`. Pages with several
forms tag the failure (`failed: 'addPromotion'`) so only the one that failed re-renders it.

**The add/edit sheet** lives in the root layout, so it opens from every screen. It posts to the
ledger's existing `create` action (`/ledger?/create`) or to the edit route's `update` / `delete`
(`/ledger/:id?/…`) and intercepts the result in its `use:enhance` callback: a redirect becomes
`invalidateAll()` — every `load` on the current screen reruns and the figures change in place,
with no navigation — and a failure stays inside the sheet as its own message, never touching the
page's `form`. The categories it offers come from the root layout's `load`, which reruns exactly
when a form action invalidates the page. Without script, the add controls are links to the
ledger's entry bar and a row is a link to `/ledger/:id`, whose own actions redirect back to the
ledger month it came from.

**Offline.** `src/service-worker.ts` sits between every page and the server, and SvelteKit
registers it on every page. It is online first:

- **The release's own files** (`$service-worker`'s `build` and `files`) are cached at install and
  served from the cache; their names carry a hash. The previous release's files are kept too, so
  a page still running it can load the rest of its code offline.
- **Pages and their data** go to the network; a 200 is kept (per release, at most 80) and served
  when the network fails, answers 502–504 (the proxy with Freyr down), or takes over 4 s — the
  late answer still lands in the cache and marks Freyr reachable, which refreshes the page.
  `__data.json` is keyed without `x-sveltekit-invalidated`, and a `skip` node is filled from the
  kept copy, so one entry answers every request for that page. A page never kept answers 503 —
  in-app, because the root layout's data is kept separately for the error page to render in.
- **Every main screen is kept without being visited**: the home page whole (a cold start opens
  on it) and each screen's data, after each release, each sync, and when the app is put away
  after a change.
- **Writes** — every script-sent form action and `/theme`, never login/setup/logout — go
  straight out when nothing is waiting. If Freyr cannot be reached the write is stored in
  IndexedDB (URL, the headers that matter, the url-encoded body) and the page gets a synthetic
  `{type:'success', status: 202}`: the sheet says _syncs when online_. Anything already waiting
  goes first, so the server always sees writes in the order they were made. The queue replays
  on Background Sync (Chromium), and — for Safari, which has none — whenever a page says the
  connection may be back (`online`, returning to the foreground, every 30 s while writes wait).
  A replay's answer is judged by `judge()`: saved, refused (parked with the server's reason for
  Retry or Discard), or not yet (unreachable, busy, or a sign-in redirect — which looks exactly
  like a saved write's redirect, so it is told apart by where it points).
- **At most once.** Every attempt at one write carries the same `x-freyr-key`; `hooks.server.ts`
  runs a keyed write once and repeats its first answer to any later attempt
  (`$lib/server/replay`), so a write whose answer was lost on a failing connection is not
  applied twice when it is replayed.
- **Signing out** deletes the kept pages, so nothing of the user's stays readable on the device.

The page's side is `sync.svelte.ts`: it holds what the worker reports and refreshes the page
(`invalidateAll`) when writes land or Freyr becomes reachable again. `SyncStatus` shows it — only
when there is something to say.

**Chart data** is read alongside each page's figures: `insights.ts` adds one grouped query per
chart (the month day by day, the months of a range, spend by category), each a range scan of
`idx_transactions_date`, so a page costs months of rows however long the ledger grows. The
ledger's daily strip is computed from the rows the page already has.

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
  hold the rules; `Money`/`Delta`/`Bullet` only render them. The reason is the test setup:
  `vite.config.ts` defines a single `node` project that excludes `*.svelte.spec.ts`, so
  there is no component environment and a pure function is the only layer a test can reach.
  Rules that had been re-derived per page are what shipped `₹0.00` to the yearly page.
- **Sessions store sha256(token), never the token.** Cookie is HttpOnly + SameSite=Lax;
  CSRF via SvelteKit's built-in origin check.
- **Theme is a cookie resolved on the server, and the page's to change.** `hooks.server.ts`
  reads `freyr_theme` and stamps `data-theme` onto `<html>` through `transformPageChunk`, so the
  correct theme is in the first byte — no flash, no blocking inline script. The setting has three
  answers: Light and Dark set the cookie; System clears it, and with no cookie there is no
  attribute and `prefers-color-scheme` decides. Every control is a form posting to `/theme`, so
  it works with JavaScript off; with it, `Ui.setTheme` swaps the attribute at once and posts
  behind it (queued like any write when offline) — the running page is the authority from then
  on, seeded from the cookie. `/theme` is exempt from both auth redirects so it also works on
  the login and setup screens.
- **Every cookie sets `secure: false` explicitly.** Freyr does not terminate TLS and is reached
  over a plain-HTTP LAN or Tailscale address, but SvelteKit defaults `secure` to true off
  localhost — and a browser silently drops a Secure cookie on `http://`. The theme cookie
  omitted the flag and so appeared to do nothing on every device except the box itself, which
  is invisible in local testing and total in real use. If TLS is ever terminated in front of
  Freyr, these three call sites are what to revisit.
- **One stylesheet, no component library, no CSS build step.** Tokens are plain custom
  properties; the dark theme re-declares them under `[data-theme='dark']` and again inside a
  `prefers-color-scheme` block for the no-cookie case. The duplication is deliberate — the
  alternative is a class-swap that flashes or a build step the stack rules out.
- **Charts are HTML and SVG laid out in percentages, rendered on the server.** No chart
  library: bars, dots and labels are positioned elements, lines are SVG paths in a stretched
  `0 0 100 100` viewBox with a non-scaling stroke, and the geometry comes from pure helpers in
  `chart.ts`. Nothing is measured, so the server paints the final picture, the chart fits any
  width with no layout shift, and a chart costs a few dozen elements and no dependency. The
  trade-off is that marks cannot be sized in pixels relative to the plot (a bar is a share of its
  slot, capped by `max-width`), which the dense layouts here never needed.
- **Client UI state is a class in context, never a module singleton.** `ui.svelte.ts` holds the
  sheet, the command menu and the toasts as `$state` fields on a `Ui` instance the root layout
  creates and provides; pages reach it with `useUi()`. A module-level store would be shared
  between requests during server render. It holds UI only — every figure still arrives by `load`.
- **Editing has its own route rather than a flag on the ledger.** `/ledger/[id]` loads one row and
  owns `update` and `delete`, so the edit form works without script, a row opened in a new tab is
  a real page, and a failed save re-renders that page with the error instead of the ledger's entry
  bar. With script the ledger opens the same `TxnForm` in the sheet and posts to the same actions.
  `updateTransaction` rewrites only the fields the form owns — goal, location, lending and the
  imported flag keep their stored values — and refuses to flip a goal contribution to income, or
  to change a repayment's direction or source, since goal progress and the lending total cannot
  tell which way a row flows and a repayment re-filed as job income would join every rollup. The ledger's old `delete` action is kept for compatibility.
- **The shell scrolls the document, not an inner panel.** The sidebar is sticky and the page
  header sticks under the viewport's top; browser scroll restoration, find-in-page, anchor jumps
  (`#day-12`) and mobile browser chrome all behave natively. `scroll-padding-top` keeps an anchor
  clear of the sticky header and table head.
- **Layout follows the content width, not the viewport.** `.page` is an inline-size container and
  the 12-column grid collapses by container query, so the icon rail or a narrow window gives the
  same result as a phone of the same content width. Only the shell itself (sidebar → rail → tab
  bar) switches on viewport breakpoints.
- **The add form narrows its categories with script, and offers all of them without.** Once the
  page runs, the category list follows the bucket or source; before it does (or with script off)
  every category is offered grouped by what it belongs to. The server's scope check in
  `txn-form.ts` refuses a mismatched pair either way, so the browser's list is a convenience, not
  the rule.
- **Offline by a hand-written service worker, with no schema change.** No Workbox and no
  client data layer: the worker caches what `load` already produced and replays the form posts
  the page already sends, so every page, action and validation rule is unchanged, and offline
  pages are simply the last server render. The price is that what was changed offline is not
  in the figures until it syncs — the sync status lists it instead of an optimistic copy of the
  domain rules in the browser. Duplicate protection is an in-memory map rather than a stored
  key: it needs no migration, and its one gap is a server restart between a lost answer and
  its replay. Browsers run service workers only on HTTPS or `localhost`; on a plain-HTTP
  address all of this is simply absent and Freyr behaves as before.
- **A release takes over at once, and an open page follows on its next navigation.** The new
  worker skips waiting; each status message carries its release, and a page whose own build
  differs makes its next navigation a full load (when online). Deciding by version rather than
  by "a worker took over" matters: the first worker to install, or a page that already loaded
  the new release from the network, is not behind.
- **The keypad's calculator is money arithmetic, so it lives in `money.ts`.** A sum is typed as
  display text (`1,200 + 45 × 3`) and never becomes a float: `evaluateAmount` works in BigInt
  fractions of paise with × and ÷ first, and rounds once, half away from zero. The server never
  sees a sum — the form posts what it comes to — so no action changed.
- **Design decisions live in [DESIGN.md](DESIGN.md)**, which is the target `src/app.css`
  implements. Colour choices there are contrast-verified rather than asserted.

_Add an entry here whenever a significant architectural decision is made._
