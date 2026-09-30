# Freyr

A self-hosted personal finance app — transaction ledger, budget tracking, goals, and
planning tools, all in one place. Replaces a 12-sheet Excel workbook. Built to start small,
grow over time, and stay snappy.

> **Status:** Phase 0+1 complete — auth, transaction ledger (add, edit, delete), monthly and
> yearly budget views with charts, a raise policy and promotion log that project the budget
> periods, home dashboard, daily backups, and the one-time Excel seed import all work. Phases 2–4
> (goals UI, registries UI, planners) are next.

## Stack

TypeScript · SvelteKit 2 (server-rendered) · SQLite via Node's built-in `node:sqlite` — no
native addons, no database server, no per-OS builds. See [STACK.md](STACK.md) for the full
rationale and [ARCHITECTURE.md](ARCHITECTURE.md) for how it's put together.

## Screens

- **Home** — answers first: what is left to spend this month (or spend so far before payday), a
  pace bar against the calendar, the change against last month over the same days, and a safe
  daily amount. Beside it a **spending-pace chart** — this month's running total against last
  month's, under the allocation. Then the month's figures with six-month sparklines, the three
  buckets as bullets (spend against allocation, with a tick for how much of the month has gone),
  where the money went by category, recent transactions and goal progress.
- **Ledger** — a month as a statement: one heading per day with its totals, rows in statement
  order (category, note, bucket, amount). A daily strip above it jumps to any day; a bucket filter
  and an instant text filter narrow it; an entry bar adds rows without leaving the keyboard.
  **Click any row to edit or delete it.**
- **Budget** — a month's allocation against spend: income, allocated, spent and left, then a card
  per bucket with its bullet, its categories ranked and its six-month trend, then the month day by
  day, stacked by bucket.
- **Year** — income, spent, net and average monthly spend against the year before; the twelve
  months as income beside spend stacked by bucket; plan against actual per bucket; the income
  split; the month-by-month table; and the year's categories ranked. Months no budget period
  covers are named rather than silently allocated zero.
- **Splits** — the raise policy and the promotion log that project the budget periods, with a
  chart of the split over time (every raise pulls the weights toward the raise split). Each split
  shows its total and proportion while you type. A period can still be typed by hand to correct a
  single month, and a hand-typed one is never overwritten.
- **Categories** — one column per bucket or income source, each with its own add field. Renaming
  carries every transaction filed under it; a category the ledger still points at can only be
  archived; delete is offered only where nothing would lose its label.
- **Settings** — the way into Splits and Categories, the theme, the account, and the keyboard map.

## Interface

Dense and keyboard-first, with charts as a first-class part of every screen. Colour carries data
and nothing else: chrome is neutral ink, the three buckets own the only chart hues, green and red
colour money figures, and amber marks focus and caution.

- **Add from anywhere** — the sidebar's _New transaction_, the phone's centre tab, or `N` opens the
  add sheet (a bottom sheet on a phone): direction, amount, bucket, a category chip, date, note.
  On a phone it has its own amount keypad with a big Add key, so the system keyboard never covers
  the form. It saves without leaving the page, refreshes the figures underneath in place, and
  starts the next entry from the last one's answers.
- **Edit and delete** — any transaction row opens the same sheet with its values; delete takes a
  confirming second press. Rows linked to a goal or a lending keep their direction.
- **⌘K** jumps to any screen, any recent month or year, or runs an action. `g` then a letter
  navigates (`g l` ledger, `g b` budget …), `[` and `]` step the month or year, `/` filters the
  ledger. The full map is on the Settings screen.
- **Charts** read on hover and on keyboard focus, and every chart has a table on the same screen
  that carries its figures.
- **Light and dark** are both first-class; the theme is a cookie resolved during server render, so
  there is no flash and the toggle works with JavaScript off.
- **Works without JavaScript** — every screen renders on the server and every write is a form:
  the add controls fall back to the ledger's entry bar, a row to its own edit page
  (`/ledger/:id`), the month picker is a native popover of links.
- **Phones** get a five-slot tab bar (Home, Ledger, add, Budget, Year), an app bar with the way
  into settings, two-line transaction rows and bottom sheets.

Every text and boundary colour is contrast-verified in both themes against every surface it can
sit on, and the chart palette is validated for colour-vision deficiency. The full spec — palette,
type scale, components, charts, keyboard and responsive rules — is [DESIGN.md](DESIGN.md).

## Getting started

Requires Node 22.13+ or 24+ (LTS lines). Odd-numbered releases such as Node 23 are refused by
the toolchain's `engines` ranges, which `.npmrc`'s `engine-strict` enforces at install.

```sh
npm install
npm run dev        # development server on http://localhost:5173
```

or for a production build:

```sh
npm run build
node build         # serves on HOST:PORT — defaults to 0.0.0.0:3000 (all interfaces)
                   # HOST=127.0.0.1 node build   # localhost only
```

On first run Freyr redirects to `/setup` to create your (single) account. The database is
`freyr.db` next to the app (override with the `FREYR_DB` env var).

### One-time Excel import

Seed the ledger from the old workbook (refuses to run twice):

```sh
npx tsx scripts/import.ts "Finances v2.xlsx" [--db freyr.db]
```

It prints a verification report (per-goal totals, lending principal left, budget periods,
yearly sums) to cross-check against the sheet, plus notes about skipped/deduplicated rows.

## Self-hosting

The app folder + `freyr.db` is the whole installation — any box with Node runs it. Freyr
listens on all interfaces by default and does not terminate TLS; reach it over a trusted LAN or a
Tailscale/WireGuard address (see STACK.md's serving posture). Daily `VACUUM INTO` snapshots
land in `backups/` (last 30 kept) — **that folder must live in or sync to a replicated
location** (Syncthing, Drive, …) so a dead disk can't take the app and its backups together.

## Development

- `npm test` — Vitest unit + page tests
- `npm run check` — svelte-check type safety
- `npm run lint` / `npm run format` — Prettier + ESLint
- `npm run passwd -- <username>` — reset a forgotten password (prints a generated one,
  or pass your own; invalidates existing sessions). Run with no arguments to list accounts.
- `npx tsx scripts/dump-workbook.ts <xlsx>` — inspect a workbook's raw layout

Conventions and engineering principles live in [CLAUDE.md](CLAUDE.md).
