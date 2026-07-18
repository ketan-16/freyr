# Architecture

How Freyr is built. Updated as the system evolves — this reflects the _current_ design, not the
original plan.

> **Status:** early. The application is not yet scaffolded, so the sections below are
> placeholders to be filled in as the architecture takes shape.

## Overview

A SvelteKit app (server-rendered, progressive enhancement) on Node.js, with SQLite
(`node:sqlite`, in-process) as the single source of truth. See [STACK.md](STACK.md) for the
technology choices and rationale.

## Modules

_To be documented as domain logic is built. Planned layout:_

```
src/hooks.server.ts            — boot (db open + migrate), session → locals, auth guard
src/lib/money.ts               — integer-paise money: parse, arithmetic, Indian-grouped format
src/lib/server/db/             — open (WAL, foreign_keys), migration runner, migrations/*.sql
src/lib/server/auth.ts         — users, bcrypt, cookie sessions
src/lib/server/ledger.ts       — transactions (the heart; everything money-flow related), rollups
src/lib/server/budgets.ts      — budget % periods, salary projections
src/lib/server/goals.ts        — goals & pots, locations, contribution tracking
src/lib/server/registry.ts     — insurance, lendings, big purchases, cards
src/lib/server/backup.ts       — daily VACUUM INTO snapshots + retention
src/lib/server/importer/       — one-time Excel seed import (exceljs)
src/routes/                    — pages: home, ledger, monthly, yearly, settings/budget,
                                 login, setup (+layout with the dense sidebar shell)
scripts/import.ts              — CLI entry for the seed import (npm run import)
```

## Data model

_To be documented when the schema is implemented. Ground rules: money columns are `INTEGER`
paise, percentages are `INTEGER` basis points, dates are `TEXT` ISO-8601; derived values are
computed at read time, never stored._

## Data flow

_Request → `load` / form action in `+page.server.ts` (thin) → `src/lib/server/*` domain
module (validation + SQL) → rendered page. Forms POST with `use:enhance` for
no-full-reload updates. To be documented in detail as routes land._

## Key decisions & trade-offs

- **Portable code over compiled binaries.** TypeScript on Node (one cross-platform runtime),
  SQLite from the Node stdlib — no native addons, no per-OS artifacts. Prior stacks
  (Elixir/Phoenix/Postgres, then a Go single binary) were dropped for toolchain footprint and
  system-dependent binaries respectively.
- **Server-rendered with progressive enhancement, no client data layer.** SvelteKit `load` +
  form actions; `use:enhance` gives instant-feeling interactions with minimal JS.
- **Money is integer paise, never floats.** Percentages are integer basis points. Enforced in
  code and by SQLite `CHECK` constraints.

_Add an entry here whenever a significant architectural decision is made._
