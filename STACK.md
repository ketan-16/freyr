# Tech Stack

A self-hosted personal finance app. Portable, server-rendered, fast.

**Architecture:** a TypeScript web application on Node.js — server-rendered pages with
progressive enhancement, SQLite as an embedded database file. **No system-dependent
binaries:** the app is portable code; Node (one cross-platform runtime) is the only thing
installed, and SQLite comes built into it (`node:sqlite`) — no native addons, no per-OS
builds, no database server.

> **History:** originally Elixir/Phoenix/PostgreSQL, briefly re-decided as a Go single
> binary; both were dropped 2026-07-18 (toolchain footprint / per-OS binaries). Final
> criteria: web-based, portable code, zero native dependencies, self-hosted. The feature
> spec was unaffected throughout.

## Core

| Layer     | Choice                                                       | Why                                                                                                                                    |
| --------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime   | **Node.js ≥ 22.13 LTS**                                      | One ubiquitous cross-platform runtime; `node:sqlite` in the stdlib.                                                                    |
| Language  | **TypeScript**                                               | One typed language top to bottom.                                                                                                      |
| Framework | **SvelteKit 2** (Svelte 5) + `adapter-node`                  | Server-rendered `load` + form actions; progressive enhancement (`use:enhance`) gives instant-feeling updates with almost no client JS. |
| Database  | **SQLite** via **`node:sqlite`** (stdlib)                    | In-process, one file, zero install. No `better-sqlite3` native addon needed.                                                           |
| DB access | Hand-written SQL + versioned migration files applied at boot | SQL the SQL way; a tiny migration runner, no ORM.                                                                                      |
| Styling   | Hand-written compact CSS (one file)                          | Dense, deliberate UI; no Tailwind/toolchain, no component library.                                                                     |

**Required SQLite configuration** (set on every open): `journal_mode=WAL`,
`busy_timeout=5000`, `foreign_keys=ON` — SQLite ships with FK enforcement off, and the
schema's FK + `CHECK` constraints are only real with it on.

## The one finance-specific rule

**Money is integer paise, never floats.** A dedicated `src/lib/money.ts` module owns parsing
("1,250.50" → `125050`), arithmetic, and Indian-grouped formatting (`₹1,23,456.78`).
Percentages are integer **basis points** (27.20% → `2720`). Integer JS arithmetic is exact
far beyond any realistic amount (2^53 paise ≈ ₹90 trillion); division always goes through an
explicit rounding helper. Enforced in code and by SQLite `CHECK` constraints.

## Standard add-ons (deliberately few)

| Need             | Choice                                                                  | Notes                                                                                                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth             | **`bcryptjs`** (pure JS) + session cookie backed by a sessions table    | Single user, created on first run. Multi-user-ready schema. Cookies `HttpOnly` + `SameSite=Lax`; CSRF via SvelteKit's built-in origin check on form actions.                                                                        |
| Excel import     | **`exceljs`** (pure JS)                                                 | One-time seed import from the old workbook, via `npm run import`.                                                                                                                                                                   |
| Backups          | built-in: daily `VACUUM INTO backups/freyr-YYYY-MM-DD.db`, keep last 30 | One consistent snapshot file per day. **Offsite is required, not optional:** `backups/` must live in (or sync to) a replicated location (e.g. a Syncthing/Drive folder) so a dead disk can't take the app and every backup with it. |
| TS script runner | **`tsx`** (dev-only)                                                    | Runs the import CLI script directly.                                                                                                                                                                                                |

## Serving & security posture

Freyr binds to **localhost** by default (configurable via `PORT`/`HOST`). Remote/phone
access is expected via the box's network layer — trusted LAN, or better, a
**Tailscale**/WireGuard address. Freyr does not terminate TLS; if exposure beyond a trusted
network is ever wanted, put a reverse proxy (e.g. Caddy) in front. Do not port-forward
Freyr to the open internet.

## Testing & quality

- **Vitest** — unit tests for all domain logic + money math; server `load`/action tests
- **svelte-check** (`npm run check`) — type safety across `.ts` and `.svelte`
- **Prettier + ESLint** (`npm run lint`) — zero-debate formatting, static checks
- CI: GitHub Actions running lint, check, test

## Deliberately not included (YAGNI)

No ORM, no Tailwind/component library, no client-side data fetching or state libraries, no
separate API layer, no Postgres, no Redis, no Docker requirement (an image can come later if
ever wanted), no native addons anywhere in the dependency tree. Add pieces only when a
concrete feature demands them.
