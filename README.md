# Freyr

A self-hosted personal finance app — transaction ledger, budget tracking, goals, and
planning tools, all in one place. Replaces a 12-sheet Excel workbook. Built to start small,
grow over time, and stay snappy.

> **Status:** Phase 0+1 complete — auth, transaction ledger, monthly/yearly budget views,
> budget periods, home dashboard, daily backups, and the one-time Excel seed import all
> work. Phases 2–4 (goals UI, registries UI, planners) are next.

## Stack

TypeScript · SvelteKit 2 (server-rendered) · SQLite via Node's built-in `node:sqlite` — no
native addons, no database server, no per-OS builds. See [STACK.md](STACK.md) for the full
rationale and [ARCHITECTURE.md](ARCHITECTURE.md) for how it's put together.

## Interface

Dense and keyboard-first: 29px table rows, 28px controls, tabular figures, and a month of
transactions on one screen. Light and dark themes are both first-class — the theme is a
cookie resolved during SSR, so there's no flash on load and the toggle works with JavaScript
off. Responsive down to a phone, where the rail becomes a bottom tab bar and tables reflow to
cards. Every colour pair is contrast-verified (text ≥ 4.5:1, UI boundaries ≥ 3:1) in both
themes.

The full spec — palette, type scale, components, responsive rules, and the logo — is
[DESIGN.md](DESIGN.md).

## Getting started

Requires Node ≥ 22.13.

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
