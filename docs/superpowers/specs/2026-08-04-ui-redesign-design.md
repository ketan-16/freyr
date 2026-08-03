# UI redesign — information architecture and DESIGN.md conformance

**Status:** approved 2026-08-04

Rebuild Freyr's six screens so the app answers "can I spend this?" at a glance, and close the
divergences between `DESIGN.md` and `src/app.css`. The design system stays as written — this
changes what the pages _say_, not what the tokens _are_.

## Why

`DESIGN.md` is implemented far better than the pages that use it. `src/app.css` carries the full
token set, both themes, the rail, the mobile card reflow, and the preference queries. The product
design on top of it never arrived:

| Spec'd                                                | Reality                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `--t-hero` — "the single headline figure on a screen" | Defined; used zero times. No screen has a headline                      |
| `delta-cell` — arrow + color + sign, mandatory        | Does not exist. Nothing compares this month to last                     |
| `money-cell` — zero renders `—`, never `₹0.00`        | `₹0.00` ships on the yearly page                                        |
| `progress-meter` — overflow segment past the cap      | `progress.ts` clamps to 100%; an overspend looks like exactly on budget |
| `progress-meter` — "always paired with a text figure" | Home and monthly meters carry no number                                 |
| `topbar` — carries the page title                     | Carries the wordmark                                                    |
| `--space-7` — auth breathing room                     | Defined; used zero times                                                |
| Rail icons `layout-dashboard`, `sliders-horizontal`   | `home`, `sliders`                                                       |

The yearly page compounds it: eight KPI tiles across three strips to show eight numbers — the
"big-icon card grid filler" the project's own principles reject.

So the work is mostly information architecture, not tokens.

## Decisions

| Question                   | Decision                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Home's role                | Command center — hero, bucket instrument, entry bar, recent activity                     |
| Home's headline figure     | Money left this month, with a delta against last month                                   |
| Delta comparison basis     | Last month **through the same day of month**, never partial-vs-complete                  |
| Zero-income days           | Honest "awaiting income" state; no estimated or carried-forward figures                  |
| Component strategy         | Rules as pure functions; appearance as CSS classes; components only where markup repeats |
| Chart tokens `--c1`…`--c5` | Not added — no chart exists to tune them against                                         |
| Uncovered domain tables    | Out of scope; a separate spec                                                            |
| Plan Tasks 7–8             | Absorbed here, so yearly and budget settings are designed once                           |
| Row delete confirmation    | Unchanged — still one click; first-use of dialogs is out of scope                        |

### Why not carry income forward

Allocation derives from income actually booked (`budgets.ts` `monthSummary`), so before payday
allocation is zero and every bucket reads as overspent. The alternatives were to carry the last
month with income forward, or to divide `salary_projections.ending_salary_paise` by twelve. Both
put an estimate where the app otherwise shows only recorded fact, and `salary_projections` is
import-seeded, per-year, and has no UI to correct it. The honest state costs no query and reuses
the `—` convention the spec already mandates.

## Modules

### `src/lib/format.ts` (new)

Pure, DOM-free, unit-tested. Owns the two rules that were duplicated into bugs.

```ts
formatCell(paise: Paise, direction?: Direction): string;
delta(
	current: Paise,
	previous: Paise,
	opts?: { lowerIsBetter?: boolean }
): { klass: 'pos' | 'neg' | 'flat'; arrow: '▲' | '▼' | '—'; text: string };
```

`formatCell` returns `—` for zero, `+₹1,250.50` when `direction` is `income`, and bare
`₹1,250.50` for an outflow or when `direction` is omitted.

`delta` returns arrow, class and signed text together so no caller can render color alone —
`DESIGN.md` makes that redundancy mandatory, and a single return value is how it stays mandatory.

**The arrow and the color are independent.** The arrow always reports the direction of the
number: `▲` when `current > previous`. The color reports whether that is good news, which
depends on the figure. Spending more is bad; having more left is good. `lowerIsBetter: true`
inverts the class only — never the arrow. So a Spent tile that rose renders a red `▲`, and that
is correct: the movement is up, the news is bad. Every call site must pass the option
deliberately; the default is `false` (higher is better).

### `src/lib/progress.ts` (extended)

`Meter` gains `overflow: number` — the width of the segment past the cap when `pct > 100`, zero
otherwise. `width` keeps clamping; `pct` keeps the true figure.

### `src/lib/server/ledger.ts` (extended)

- `TxnFilter` gains `limit?: number` → `LIMIT ?`. Serves home's recent-activity list.
- `monthlyActuals` and `yearlySummary` each gain `through?: string`, an exclusive upper date bound
  narrowing the existing half-open range. Serves the same-day and same-day-of-year delta
  comparisons. Both remain a single one-row aggregate; the bound tightens the existing index range
  rather than adding a scan.

### Components

Three, and only three:

| Component         | Why it exists                                                 |
| ----------------- | ------------------------------------------------------------- |
| `Money.svelte`    | The zero/sign convention appears in every table on every page |
| `Delta.svelte`    | Arrow, class and sign must not be separable at the call site  |
| `EntryBar.svelte` | Home and ledger must share one entry form or they will drift  |

Everything else stays plain markup plus a CSS class, matching the existing grain.

## Screens

### Shell

Topbar carries the page title, derived from the pathname against the nav table already in
`+layout.svelte` — no new state, no store, no context. Rail icons corrected to
`layout-dashboard` and `sliders-horizontal`; two path entries added to `Icon.svelte`.

### Home

```
August 2026                              This month

₹42,318 left            ▲ ₹3,200 vs July
of ₹1,00,000 allocated · 12 days remaining

BUCKET   USED         ALLOCATED   ACTUAL   REMAINING
Needs    ██████░░░░ 68%  27,200.00  18,400.00   8,800.00
Wants    ████████░░ 74%  30,000.00  22,100.00   7,900.00
Invest   ████░░░░░░ 40%  42,800.00  17,182.00  25,618.00

[ entry bar — date, amount, direction, bucket, category, note ]

RECENT
04 Aug   1,250.50  wants   Eating out  dinner w/ S
03 Aug     340.00  needs   Groceries
02 Aug  +50,000.00 income  job

GOALS  Car ███░░ 34%  ·  Lendings out ₹1,86,000
```

Home gains a `create` action mirroring the ledger's, redirecting to `/`. Meters carry their
percentage, per the spec's "the bar is a glance, the number is the truth" — here and on monthly,
wherever a meter appears.

**The hero figure is the sum of the bucket rows' `remaining`**, not an independently computed
`income − spent`. The two agree to within a rounding paisa because weights sum to 100%, and
"within a rounding paisa" is exactly the disagreement a reader would notice between the headline
and the table directly beneath it. One source, no drift.

**Awaiting income** (booked income is zero): hero reads spend-so-far, allocated and remaining
render `—`, meters are omitted entirely, and a `notice` states why.

### Ledger

Money cells adopt the sign and zero convention. Filter bar per spec. Otherwise the strongest
page already, and the least changed.

### Monthly

KPI strip gains delta cells against the previous month — full-month against full-month for a
past month, through-same-day for the current one. Month stepper gains the spec'd left/right
arrow keys.

### Yearly

Eight tiles across three strips collapse to one three-tile strip (Income, Spent, Net with a
delta against the prior year) plus a compact by-month table. Job and side-hustle income become
columns, not tiles. Absorbs plan Task 8: allocated, variance, effective rate, unallocated.

The prior-year delta follows the same partial-versus-complete rule as monthly: a past year
compares whole against whole, the current year compares through today's day-of-year. A year
in progress is never compared against a finished one.

### Budget settings

Rebuilt around policy and promotions: base and marginal weights, the promotions list with an
add form, and the derived periods table tagged by `source`. Absorbs plan Task 7.

### Auth

`--space-7` breathing room; mark at the spec'd 56px rather than 64px.

## Performance

Home is the only screen whose query count changes:

| Query                                            | Shape                                                  |
| ------------------------------------------------ | ------------------------------------------------------ |
| `monthSummary` (current month)                   | Existing — one indexed range aggregate + period lookup |
| `monthlyActuals` (prior, through day)            | One indexed range aggregate, one row                   |
| `listTransactions({ limit: 8 })`                 | Descending scan of `idx_transactions_date`, 8 rows     |
| `goalProgress`                                   | Existing                                               |
| `openLendingsTotal`                              | Existing                                               |
| `listCategories` / `listGoals` / `listLocations` | Entry-bar reference lists — three small full reads     |

Nine bounded queries in total: the five figure-producing ones above, `monthSummary`'s internal
period lookup, and the three reference lists the entry bar needs — the same three `/ledger`
already performs on every load, over tables holding dozens of rows. No N+1, no full scans of
`transactions`. Recent activity is `LIMIT`-bounded so it stays constant-cost as the ledger grows
past a decade of transactions. No new client JavaScript beyond the `use:enhance` already in use,
no new assets, no fonts, no images — page weight is unchanged.

The yearly page's existing N+1 is killed by plan Task 6, which runs before this work.

## Sequencing

Plan Tasks 5–6 (promotions domain and projection rebuild; yearly N+1 and yearly allocation) are a
**prerequisite, not part of this spec** — they already have a spec and an implementation plan in
`docs/superpowers/plans/2026-08-03-promotion-driven-weights.md`. Yearly and budget settings need
the data they produce.

Then: Foundation → Shell → Home → Ledger → Monthly → Yearly → Budget settings → Auth → docs.
Foundation, Shell and Home touch no promotion data and may run in parallel with Tasks 5–6 if
visible progress is wanted sooner.

## Testing

- `src/lib/format.spec.ts` — zero renders `—`; inflow carries `+`; outflow and an omitted
  direction render bare; delta returns arrow, class and text together for positive, negative and
  flat. Specifically: **a rise under `lowerIsBetter` keeps `▲` and flips the class to `neg`** —
  the case the whole option exists for.
- `src/lib/progress.spec.ts` — extended for `overflow`: zero at or under the cap, the excess above it.
- `src/lib/server/ledger.spec.ts` — extended for `limit`, and for `through` on both
  `monthlyActuals` and `yearlySummary`, including `through` beyond the period end (no-op) and
  before its start (empty).
- `src/routes/pages.spec.ts` — extended for home's `create` action and its recent-activity list;
  the awaiting-income state returns null allocations rather than zeroes.
- Gates: `npm run check`, `npm run lint`, `npm test` clean at the end of every phase.

No new color tokens are introduced, so no new contrast verification is required. Both themes are
exercised by the same markup, per the spec's rule that a token change lands with its dark
counterpart in the same commit.

## Error handling

Unchanged in kind. Home's `create` action reuses the ledger's validation and failure shape —
`400` with the entered values preserved and a message tied to the offending control by
`aria-describedby`. A failed add on home re-renders home, not the ledger.

## Out of scope

- The thirteen domain tables with no UI — insurance, cards and rewards, SIPs, big purchases,
  emergency fund, salary projections, goal moves. Their own spec.
- Charts and the `--c1`…`--c5` ramp. `DESIGN.md` already records these as a known gap; nothing
  exists to tune the ramp against.
- Dialogs, including a delete confirmation. First use of the `raised` elevation level deserves
  its own decision.
- Transaction editing. Rows stay add-and-delete, as `DESIGN.md` § Known Gaps records.
- Print styles.
