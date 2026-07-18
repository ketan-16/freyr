# Freyr — Self-Hosted Personal Finance App

Server-rendered, portable, self-hosted. Starts small, grows over time, stays snappy.

Tech stack: @STACK.md

## Engineering principles

- **Follow each language's best practices and idioms.** Write code that looks native to its
  ecosystem — TypeScript the TypeScript way, Svelte the Svelte way, SQL the SQL way. No
  fighting the grain of the tool.
- **Assess performance impact before implementing.** For every feature request, state its cost
  *before* writing code: query shape (watch for N+1 and full scans), page weight, memory, and
  whether it stays fast as data grows. Propose the efficient approach, not just a working one.
  "Snappy always" is a hard requirement, not a nice-to-have.
- **YAGNI.** Reach for the platform (Node stdlib, SvelteKit built-ins, the browser) before
  adding a dependency. Add pieces only when a concrete feature demands them.
- **Money is never a float.** Always integer paise via `src/lib/money.ts`; percentages are
  integer basis points. JS number arithmetic on integers is exact in this range; never divide
  without an explicit rounding rule. Enforce invariants in domain code *and* SQLite `CHECK`
  constraints.

## TypeScript / SvelteKit conventions

- Domain logic lives in **`src/lib/server/*` modules** (ledger, budgets, goals, registry,
  auth); keep `+page.server.ts` thin (parse form/params → call domain → return/redirect).
- Server-rendered only: `load` + form actions with `use:enhance`. No client-side data
  fetching, no client state libraries.
- SQL is hand-written and lives with the module that owns it; migrations are versioned files
  applied at boot.
- Validate every write in the domain layer; back hard invariants with SQLite constraints.
- Before calling work done: `npm run check`, `npm run lint`, `npm test` all clean.

## UI / design

**Super compact**, clean, and deliberately **not AI-slop**. Maximize information density — this
is a finance app for daily power use, not a marketing page. When in doubt, fit *more* on screen,
legibly.

- **Avoid the generic AI look:** no gratuitous purple/violet gradients, no emoji used as UI
  icons, no oversized rounded corners everywhere, no glassmorphism, no centered hero text for
  ordinary screens, no "big-icon card grid" filler.
- **Do this instead:** restrained, consistent palette; clear typographic hierarchy; align to a
  grid. Default to a **tight spacing scale and small, dense controls** so more fits on screen
  without feeling cramped. Favor data density: compact tables, right-aligned `tabular-nums`
  figures, +/− color used sparingly. Whitespace is purposeful, never cavernous.
- **Icons:** one modern line-icon set, used consistently (same weight/size, `currentColor`).
  Prefer **Lucide** as inline SVG (no icon font, no CDN). Never mix sets.
- **Accessibility is table stakes:** real contrast, visible focus states, keyboard navigation.

## Documentation

- Maintain `README.md`. **After completing any task, update the README** (and `STACK.md` if the
  stack changed) so the docs always match reality.
- Maintain `ARCHITECTURE.md` — how the system is built (modules, data flow, key decisions and
  trade-offs). **Keep it updated as the architecture evolves**, so it always reflects the
  current design rather than the original plan.
- Keep docs concise and truthful — document what exists, not aspirational features.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`.

- Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`.
- Mark breaking changes with `!` after the type/scope (e.g. `feat(api)!:`) or a `BREAKING CHANGE:`
  footer.
- Keep the summary imperative and lowercase; e.g. `feat(ledger): add recurring transaction rules`.
