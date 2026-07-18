# Freyr

A self-hosted personal finance app — transaction ledger, budget tracking, goals, and
planning tools, all in one place. Replaces a 12-sheet Excel workbook. Built to start small,
grow over time, and stay snappy.

> **Status:** early. Stack chosen (TypeScript / SvelteKit / SQLite via `node:sqlite`); the
> application is not yet scaffolded.

## Stack

TypeScript · SvelteKit (server-rendered) · SQLite (built into Node, no native addons).
Portable code on one cross-platform runtime — no system-dependent binaries. See
[STACK.md](STACK.md) for the full breakdown and rationale, and
[ARCHITECTURE.md](ARCHITECTURE.md) for how it's put together.

## Getting started

_To be filled in once the app is scaffolded. It will amount to: install Node ≥ 22.13 LTS,
`npm install`, `npm run dev` (or `npm run build && node build`)._

## Self-hosting

_To be filled in once the app exists. The model: the app folder + `freyr.db` on any box with
Node; daily snapshot backups land in `backups/`, which should live in a synced/replicated
directory._

## Contributing / conventions

Project conventions and guidelines live in [CLAUDE.md](CLAUDE.md).
