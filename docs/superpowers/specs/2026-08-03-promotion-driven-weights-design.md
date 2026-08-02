# Promotion-driven W/N/I weights

**Status:** approved 2026-08-03

Log a promotion as an event — effective date and raise percentage. That recomputes the
Wants/Needs/Investments split, which drives monthly allocations, from which yearly figures
derive. Replaces the spreadsheet's hand-maintained, year-indexed ratio columns.

## Why

The workbook's `Budget` tab encodes a genuinely good rule: the **base** salary splits
50/30/20 but every **raise** splits 20/30/50, so raises flow disproportionately to
investing and the needs share falls automatically. Two problems made it unusable:

1. It is indexed by **year**, assuming exactly one raise, effective 1 January. Real
   promotions land mid-year and arrive twice in a year or not for two years. Modelling
   January raises overstates planned cash by two-thirds of each increment — about
   **₹14.3 lakh, 9.6% of planned cash, across 2022–2030**.
2. The ratios are pasted literals. Nothing derives them, so the design intent
   ("20/30/50 asymptote") appears nowhere and cannot be verified.

This design keeps the rule and fixes both: the event is the input, every ratio is derived.

## Core insight

For a raise of fraction `g`, each bucket's share moves by a recurrence that is
**independent of salary**:

```
share' = (share + marginal × g) / (1 + g)
```

Folded over promotions, this has a drift-free closed form in the cumulative growth factor
`F = Π (1 + gᵢ)`:

```
share_b = marginal_b + (base_b − marginal_b) / F
```

**Consequence: the promotion percentage alone is sufficient. No salary figures are needed
to derive weights.** Verified against the real workbook — the fold reproduces all ten years
of the `Budget` tab's `H:J` columns to within `1.67e-12` basis points.

Because wants is 30% of both the base and the margin, wants stays pinned at exactly 30.00%
under the default policy. That is by construction. To make wants shrink as income grows,
marginal wants must drop below 30.

## Decisions

| Question          | Decision                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| Yearly allocation | Sum of monthly allocations; each month uses the weights in force that month   |
| Marginal split    | 20/30/50, stored in an editable policy table                                  |
| Manual periods    | Kept alongside generated ones, discriminated by a `source` column             |
| Promotion scope   | Weights only — no salary stored; income keeps coming from ledger transactions |
| Mid-month raises  | Snap to month start; no intra-month pro-rating                                |
| Pay cuts          | Not representable (`increment_bp > 0`); use a manual period                   |

## Data model

`promotions` and `budget_policy` are the source of truth. `budget_periods` becomes a
**materialized projection** rebuilt from them. Everything downstream — `activeFor`,
`allocate`, `monthSummary`, the home and monthly pages — is unchanged.

```sql
-- migration 0003_promotions.sql

CREATE TABLE budget_policy (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),   -- single row
    base_effective_from TEXT    NOT NULL,
    base_needs_bp       INTEGER NOT NULL CHECK (base_needs_bp  BETWEEN 0 AND 10000),
    base_wants_bp       INTEGER NOT NULL CHECK (base_wants_bp  BETWEEN 0 AND 10000),
    base_invest_bp      INTEGER NOT NULL CHECK (base_invest_bp BETWEEN 0 AND 10000),
    marg_needs_bp       INTEGER NOT NULL CHECK (marg_needs_bp  BETWEEN 0 AND 10000),
    marg_wants_bp       INTEGER NOT NULL CHECK (marg_wants_bp  BETWEEN 0 AND 10000),
    marg_invest_bp      INTEGER NOT NULL CHECK (marg_invest_bp BETWEEN 0 AND 10000),
    CHECK (base_needs_bp + base_wants_bp + base_invest_bp = 10000),
    CHECK (marg_needs_bp + marg_wants_bp + marg_invest_bp = 10000)
);

CREATE TABLE promotions (
    id             INTEGER PRIMARY KEY,
    effective_date TEXT    NOT NULL UNIQUE,
    increment_bp   INTEGER NOT NULL CHECK (increment_bp > 0),
    note           TEXT
);
```

`budget_periods` is recreated (SQLite cannot drop a UNIQUE constraint) to add:

- `source TEXT NOT NULL CHECK (source IN ('base','promotion','manual'))`
- `promotion_id INTEGER REFERENCES promotions(id) ON DELETE CASCADE`
- `CHECK ((source = 'promotion') = (promotion_id IS NOT NULL))`
- `UNIQUE(effective_from, source)` replacing `UNIQUE(effective_from)`

Existing rows copy across as `source = 'manual'`, so imported and hand-entered periods
survive untouched.

**Precedence on the same date: `manual` > `promotion` > `base`.** `activeFor` orders by
`effective_from DESC`, then that rank descending, then `id DESC`. A hand-typed correction
always beats a generated row.

Default policy seeded by the migration: base `2021-09-01` at 5000/3000/2000, marginal
2000/3000/5000.

## Modules

### `src/lib/server/budget-policy.ts` (new)

Pure functions, no database — the whole fold is testable without SQLite.

```ts
export interface Policy {
	baseEffectiveFrom: string;
	base: TripleBP;
	marginal: TripleBP;
}
export interface TripleBP {
	needsBP: number;
	wantsBP: number;
	investBP: number;
}

/** Exact shares folded over promotions, rounded to integer bp summing to 10000. */
export function weightsAfter(policy: Policy, incrementsBP: number[]): TripleBP;

/** Largest-remainder rounding; always returns three integers summing to exactly 10000. */
export function roundTripleBP(exact: [number, number, number]): [number, number, number];
```

**Money rule compliance.** `F` and the intermediate shares are dimensionless ratios, never
money. They are the only floats in the feature, their output is integer basis points, and
`allocate()` continues to use integer `mulBP`. No float touches an amount at any point.

Rounding: floor all three, then hand the 10000 − Σfloor remaining units (always 0, 1 or 2)
to the largest fractional parts, ties broken by bucket order for determinism.

### `src/lib/server/promotions.ts` (new)

```ts
export function listPromotions(db): Promotion[];
export function createPromotion(db, p: { effectiveDate; incrementBP; note? }): number;
export function deletePromotion(db, id: number): void;
export function rebuildProjectedPeriods(db): void;
```

`rebuildProjectedPeriods` runs in **one transaction**: delete every period with
`source IN ('base','promotion')`, then fold promotions in date order and insert one period
per promotion plus the base period. Idempotent by construction; `manual` rows are never
touched. Called after any promotion create/delete or policy change.

Generated `effective_from` is the **month start** of the promotion's effective date, so a
15 September promotion makes September use the new weights — matching how a raise hits that
month's pay. The promotion row retains the true date for display.

### `src/lib/server/budgets.ts` (extended)

```ts
export function getPolicy(db): Policy;
export function updatePolicy(db, p: Policy): void; // triggers a rebuild
export function yearlyAllocation(db, year): YearlyAllocation;
```

`yearlyAllocation` sums per-month allocations so a mid-year promotion is handled correctly,
and reports the **blended effective rate** per bucket (allocated ÷ income) as a derived
figure — the number previously computed by hand in the workbook.

### `src/lib/server/ledger.ts` (extended)

```ts
export function monthlyActualsForYear(db, year): MonthActuals[]; // one GROUP BY
```

Replaces the per-month `monthlyActuals` loop.

## Performance

Stated per the project's cost-before-code rule.

| Operation                 | Shape                                                    | Cost                                  |
| ------------------------- | -------------------------------------------------------- | ------------------------------------- |
| `weightsAfter`            | in-memory fold over promotions                           | O(n), n = tens over a career          |
| `rebuildProjectedPeriods` | one transaction, n+1 inserts                             | O(n), only on promotion/policy change |
| `activeFor`               | unchanged index scan, `LIMIT 1`                          | O(log n)                              |
| `yearlyAllocation`        | reuses the grouped rollup + 1 period fetch, folded in JS | flat as years accumulate              |

`/yearly` currently issues **15 queries** for a full year: `years`, `yearlySummary`,
`monthsWithData`, then `monthlyActuals` once per month — an N+1 in code this feature already
touches. `monthlyActualsForYear` collapses that 13-query months rollup to a single
`GROUP BY`, and `yearlyAllocation` reuses its result rather than re-reading. The page lands
at **4 queries** (`years`, `yearlySummary`, `monthlyActualsForYear`, `listPeriods`),
constant regardless of how many months have data.

No new indexes needed: `budget_periods.effective_from` is already covered by its UNIQUE
constraint, and `promotions` is small enough to scan.

## UI

One page, `/settings/budget`, three compact sections following DESIGN.md density rules:

- **Policy** — base and marginal triples, with the long-run destination shown so the
  asymptote is visible rather than implied.
- **Promotions** — log form (effective date, raise %, note) and a table where each row shows
  the resulting W/N/I, so the effect of a raise is legible at a glance. Delete per row.
- **Periods** — the existing manual editor, with `base`/`promotion`/`manual` source badges.

`/yearly` gains `allocated | actual | variance | effective rate` per bucket, plus
**unallocated income** — income minus the three buckets. That figure is what exposed the 58%
tracking shortfall in the 2022 workbook row, where an incomplete needs total read as a
favourable variance.

## Error handling

Validated in the domain layer, backed by SQLite constraints:

- Effective date must be `YYYY-MM-DD` (reuses `createPeriod`'s existing check).
- `increment_bp > 0` — rejected in code with a readable message and by `CHECK`.
- Duplicate promotion date — caught as a `UNIQUE` violation, surfaced as a form error.
- Policy triples must each sum to 10000 — checked in code and by two `CHECK` constraints.
- Rebuild is transactional: a failure mid-rebuild rolls back, never leaving partial periods.

Form actions return `fail(400, { error, values })` so the form re-renders with what was
typed, matching the existing convention.

## Testing

The strongest available fixture is the real workbook: the fold must reproduce the `Budget`
tab's ten-year trajectory.

| Year | Increment | Expected bp (N/W/I) |
| ---- | --------- | ------------------- |
| 2021 | —         | 5000 / 3000 / 2000  |
| 2022 | 30.50%    | 4299 / 3000 / 2701  |
| 2023 | 90.50%    | 3207 / 3000 / 3793  |
| 2024 | 11.11%    | 3086 / 3000 / 3914  |
| 2025 | 50.85%    | 2720 / 3000 / 4280  |
| 2026 | 5.40%     | 2683 / 3000 / 4317  |
| 2027 | 10.00%    | 2621 / 3000 / 4379  |
| 2028 | 10.00%    | 2565 / 3000 / 4435  |
| 2029 | 10.00%    | 2513 / 3000 / 4487  |
| 2030 | 10.00%    | 2467 / 3000 / 4533  |

Also covered:

- `roundTripleBP` sums to exactly 10000 across adversarial inputs, including three-way ties.
- Wants holds at exactly 3000 bp across the whole trajectory under the default policy.
- A non-default marginal triple moves wants, confirming the pin is policy, not hard-coding.
- Two promotions inside one calendar year; a two-year gap with no promotion.
- A promotion dated mid-month takes effect that same month.
- `rebuildProjectedPeriods` is idempotent; manual rows survive it; same-date precedence
  resolves manual over promotion over base.
- Migration 0003 tags pre-existing periods `manual` and preserves their values.
- `yearlyAllocation` against a mid-year promotion equals the sum of its months, and its
  blended rate sits between the two period rates.

## Out of scope

- Storing or projecting salary. `salary_projections` stays as imported; income continues to
  come from ledger transactions.
- Intra-month pro-rating of a raise.
- Editing a promotion in place — delete and re-log. Rebuild makes this cheap and safe.
- Backfilling historical promotions from the imported workbook.
