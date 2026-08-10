# Promotion-driven W/N/I Weights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log a promotion (effective date + raise %) and have it derive the Wants/Needs/Investments split, which drives monthly allocations, from which yearly figures roll up.

**Architecture:** `promotions` + `budget_policy` become the source of truth; `budget_periods` becomes a materialized projection rebuilt transactionally from them. A pure, database-free fold turns a promotion history into basis-point weights via the salary-independent closed form `share = marginal + (base − marginal) / F`. Everything downstream (`activeFor`, `allocate`, `monthSummary`, home and monthly pages) keeps working unchanged.

**Tech Stack:** SvelteKit 2 (Svelte 5), TypeScript, `node:sqlite`, Vitest. Hand-written SQL, versioned `.sql` migrations applied at boot.

**Spec:** [2026-08-03-promotion-driven-weights-design.md](../specs/2026-08-03-promotion-driven-weights-design.md)

## Global Constraints

- **Money is never a float.** Integer paise via `src/lib/money.ts`; percentages integer basis points. The only floats permitted in this feature are `F` and the intermediate shares inside `budget-policy.ts` — dimensionless ratios, never money. Every rupee figure still goes through integer `mulBP`.
- **Domain logic lives in `src/lib/server/*`.** `+page.server.ts` stays thin: parse form/params → call domain → return/redirect.
- **Validate every write in the domain layer**, and back hard invariants with SQLite `CHECK` constraints.
- **Server-rendered only.** `load` + form actions with `use:enhance`. No client-side data fetching, no client state libraries.
- **Form errors** return `fail(400, { error, values })` so the form re-renders with what was typed.
- **Migrations must not contain `BEGIN`/`COMMIT`** — the runner in `src/lib/server/db/index.ts:65-78` already wraps each file in a transaction.
- **Before calling work done:** `npm run check`, `npm run lint`, `npm test` all clean.
- **Commits:** Conventional Commits, imperative lowercase summary. Never add a `Co-Authored-By` trailer.
- **UI:** super compact, dense, `tabular-nums` figures right-aligned, Lucide icons via the existing `Icon` component only. No emoji as icons.

## File Structure

| File                                                        | Responsibility                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/lib/server/db/migrations/0003_promotions.sql` (create) | `budget_policy`, `promotions`, rebuilt `budget_periods` with `source`/`promotion_id` |
| `src/lib/dates.ts` (modify)                                 | add `monthStart(iso)`                                                                |
| `src/lib/server/budget-policy.ts` (create)                  | pure fold + largest-remainder rounding; no database                                  |
| `src/lib/server/budget-policy.spec.ts` (create)             | fold tests, incl. the real workbook trajectory                                       |
| `src/lib/server/promotions.ts` (create)                     | promotions CRUD, policy row CRUD, transactional projection rebuild                   |
| `src/lib/server/promotions.spec.ts` (create)                | CRUD, rebuild idempotency, precedence, multi-promotion months                        |
| `src/lib/server/budgets.ts` (modify)                        | `source` on `Period`, precedence in `activeFor`/`listPeriods`, `yearlyAllocation`    |
| `src/lib/server/ledger.ts` (modify)                         | `monthlyActualsForYear` — one `GROUP BY` replacing the per-month N+1                 |
| `src/routes/settings/budget/+page.server.ts` (modify)       | policy + promotion form actions                                                      |
| `src/routes/settings/budget/+page.svelte` (modify)          | Policy / Promotions / Periods sections                                               |
| `src/routes/yearly/+page.server.ts` (modify)                | use the grouped rollup + `yearlyAllocation`                                          |
| `src/routes/yearly/+page.svelte` (modify)                   | allocated / actual / variance / effective-rate columns + unallocated                 |

**Why policy accessors live in `promotions.ts`, not `budgets.ts`** (a refinement on the spec): `updatePolicy` must trigger a rebuild, and the rebuild needs the fold. Putting `getPolicy`/`updatePolicy` in `budgets.ts` would make `budgets.ts` import `promotions.ts` while `promotions.ts` imports `budgets.ts` — a cycle. Keeping everything that owns _derived_ weights in `promotions.ts` leaves `budgets.ts` importing only `budget-policy.ts`.

---

### Task 1: Migration — policy, promotions, and a tagged `budget_periods`

**Files:**

- Create: `src/lib/server/db/migrations/0003_promotions.sql`
- Test: `src/lib/server/db/schema.spec.ts` (modify — append to the existing file)

**Interfaces:**

- Consumes: nothing
- Produces: tables `budget_policy` (single row, id = 1), `promotions` (`id`, `effective_date` UNIQUE, `increment_bp`, `note`), and `budget_periods` with added `source TEXT NOT NULL DEFAULT 'manual'` and `promotion_id INTEGER NULL`, keyed `UNIQUE(effective_from, source)`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/server/db/schema.spec.ts`. Match the existing file's import style — read its first 15 lines first and reuse whatever `testDb` helper and imports it already has.

```ts
describe('0003 promotions schema', () => {
	it('seeds exactly one policy row with the 50/30/20 base and 20/30/50 margin', () => {
		const row = db
			.prepare(
				`SELECT base_effective_from, base_needs_bp, base_wants_bp, base_invest_bp,
				        marg_needs_bp, marg_wants_bp, marg_invest_bp
				 FROM budget_policy`
			)
			.all() as Record<string, unknown>[];
		expect(row).toHaveLength(1);
		expect(row[0]).toMatchObject({
			base_effective_from: '2021-09-01',
			base_needs_bp: 5000,
			base_wants_bp: 3000,
			base_invest_bp: 2000,
			marg_needs_bp: 2000,
			marg_wants_bp: 3000,
			marg_invest_bp: 5000
		});
	});

	it('refuses a second policy row', () => {
		expect(() =>
			db
				.prepare(
					`INSERT INTO budget_policy (id, base_effective_from,
					   base_needs_bp, base_wants_bp, base_invest_bp,
					   marg_needs_bp, marg_wants_bp, marg_invest_bp)
					 VALUES (2, '2022-01-01', 5000, 3000, 2000, 2000, 3000, 5000)`
				)
				.run()
		).toThrow();
	});

	it('refuses policy triples that do not sum to 100%', () => {
		expect(() =>
			db.prepare('UPDATE budget_policy SET base_needs_bp = 4000 WHERE id = 1').run()
		).toThrow();
	});

	it('refuses a non-positive or duplicate promotion', () => {
		db.prepare('INSERT INTO promotions (effective_date, increment_bp) VALUES (?, ?)').run(
			'2025-09-15',
			2000
		);
		expect(() =>
			db
				.prepare('INSERT INTO promotions (effective_date, increment_bp) VALUES (?, ?)')
				.run('2026-01-01', 0)
		).toThrow();
		expect(() =>
			db
				.prepare('INSERT INTO promotions (effective_date, increment_bp) VALUES (?, ?)')
				.run('2025-09-15', 1000)
		).toThrow();
	});

	it('defaults budget_periods.source to manual and allows one row per source per date', () => {
		db.prepare(
			`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp)
			 VALUES ('2025-01-01', 2720, 3000, 4280)`
		).run();
		const source = db
			.prepare(`SELECT source FROM budget_periods WHERE effective_from = '2025-01-01'`)
			.get() as { source: string };
		expect(source.source).toBe('manual');

		// same date, different source — allowed
		db.prepare(
			`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp, source)
			 VALUES ('2025-01-01', 5000, 3000, 2000, 'base')`
		).run();

		// same date, same source — rejected
		expect(() =>
			db
				.prepare(
					`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp, source)
					 VALUES ('2025-01-01', 5000, 3000, 2000, 'base')`
				)
				.run()
		).toThrow();
	});

	it('ties promotion_id to source = promotion', () => {
		expect(() =>
			db
				.prepare(
					`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp, source)
					 VALUES ('2027-01-01', 5000, 3000, 2000, 'promotion')`
				)
				.run()
		).toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/db/schema.spec.ts`
Expected: FAIL — `no such table: budget_policy`

- [ ] **Step 3: Write the migration**

Create `src/lib/server/db/migrations/0003_promotions.sql`. Order matters: `promotions` must exist before the new `budget_periods` references it.

```sql
-- Promotion-driven weights: promotions + policy are the source of truth,
-- budget_periods becomes a projection rebuilt from them.

CREATE TABLE budget_policy (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
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

INSERT INTO budget_policy
    (id, base_effective_from,
     base_needs_bp, base_wants_bp, base_invest_bp,
     marg_needs_bp, marg_wants_bp, marg_invest_bp)
VALUES (1, '2021-09-01', 5000, 3000, 2000, 2000, 3000, 5000);

CREATE TABLE promotions (
    id             INTEGER PRIMARY KEY,
    effective_date TEXT    NOT NULL UNIQUE,
    increment_bp   INTEGER NOT NULL CHECK (increment_bp > 0),
    note           TEXT
);

-- SQLite cannot drop the old UNIQUE(effective_from), so rebuild the table.
-- Nothing references budget_periods, so no foreign keys are orphaned.
ALTER TABLE budget_periods RENAME TO budget_periods_old;

CREATE TABLE budget_periods (
    id             INTEGER PRIMARY KEY,
    effective_from TEXT    NOT NULL,
    needs_bp       INTEGER NOT NULL CHECK (needs_bp  BETWEEN 0 AND 10000),
    wants_bp       INTEGER NOT NULL CHECK (wants_bp  BETWEEN 0 AND 10000),
    invest_bp      INTEGER NOT NULL CHECK (invest_bp BETWEEN 0 AND 10000),
    source         TEXT    NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('base', 'promotion', 'manual')),
    promotion_id   INTEGER REFERENCES promotions(id) ON DELETE CASCADE,
    CHECK (needs_bp + wants_bp + invest_bp = 10000),
    CHECK ((source = 'promotion') = (promotion_id IS NOT NULL)),
    UNIQUE (effective_from, source)
);

INSERT INTO budget_periods
    (id, effective_from, needs_bp, wants_bp, invest_bp, source, promotion_id)
SELECT id, effective_from, needs_bp, wants_bp, invest_bp, 'manual', NULL
FROM budget_periods_old;

DROP TABLE budget_periods_old;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/server/db/`
Expected: PASS, including the pre-existing `budget_periods` constraint tests — they must keep passing, proving the rebuilt table preserved every old invariant.

- [ ] **Step 5: Verify existing periods actually survive the upgrade**

This is the step that protects live data: the user's real `freyr.db` already holds imported `budget_periods` rows, and the `INSERT … SELECT … FROM budget_periods_old` copy only ever runs on a genuine upgrade. `testDb()` migrates an empty database, so it never exercises that path. Make the path testable by letting `migrate` stop at a version.

In `src/lib/server/db/index.ts`, change the signature and the loop guard — nothing else:

```ts
/**
 * Applies bundled migrations in filename order; each runs once, inside a
 * transaction. `upTo` stops after that version, which lets tests reproduce an
 * older database and then upgrade it.
 */
export function migrate(db: DatabaseSync, upTo = Infinity): void {
```

and inside the loop, immediately after the existing `if (applied.has(m.version)) continue;`:

```ts
if (m.version > upTo) break;
```

Then write the real test in `src/lib/server/db/schema.spec.ts`:

```ts
it('preserves pre-existing periods as manual rows across the 0003 upgrade', () => {
	const fresh = open(join(mkdtempSync(join(tmpdir(), 'freyr-upgrade-')), 'test.db'));
	try {
		migrate(fresh, 2); // the schema as it stood before this feature
		fresh
			.prepare(
				`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp)
				 VALUES ('2024-08-01', 3086, 3000, 3914)`
			)
			.run();

		migrate(fresh); // now apply 0003

		const rows = fresh
			.prepare('SELECT effective_from, needs_bp, wants_bp, invest_bp, source FROM budget_periods')
			.all() as Record<string, unknown>[];
		expect(rows).toEqual([
			{
				effective_from: '2024-08-01',
				needs_bp: 3086,
				wants_bp: 3000,
				invest_bp: 3914,
				source: 'manual'
			}
		]);
	} finally {
		fresh.close();
	}
});
```

Add the imports this test needs at the top of the spec file if absent: `mkdtempSync` from `node:fs`, `tmpdir` from `node:os`, `join` from `node:path`, and `migrate`/`open` from `./index`.

Run: `npx vitest run src/lib/server/db/ && npm test`
Expected: PASS — and this is the one test that proves the migration will not eat the user's imported budget periods.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/db/migrations/0003_promotions.sql src/lib/server/db/schema.spec.ts src/lib/server/db/index.ts
git commit -m "feat(db): promotions, budget policy and source-tagged budget periods"
```

---

### Task 2: The pure fold

**Files:**

- Create: `src/lib/server/budget-policy.ts`
- Create: `src/lib/server/budget-policy.spec.ts`

**Interfaces:**

- Consumes: nothing (no database, no imports beyond types)
- Produces:
  - `interface TripleBP { needsBP: number; wantsBP: number; investBP: number }`
  - `interface Policy { baseEffectiveFrom: string; base: TripleBP; marginal: TripleBP }`
  - `const TOTAL_BP = 10000`
  - `function assertTriple(t: TripleBP, label: string): void`
  - `function roundTripleBP(exact: [number, number, number]): [number, number, number]`
  - `function weightsAfter(policy: Policy, incrementsBP: number[]): TripleBP`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/budget-policy.spec.ts`. The headline fixture is the real workbook: nine increments reproducing ten years of the `Budget` tab.

```ts
import { describe, expect, it } from 'vitest';
import {
	assertTriple,
	roundTripleBP,
	weightsAfter,
	type Policy,
	type TripleBP
} from './budget-policy';

const POLICY: Policy = {
	baseEffectiveFrom: '2021-09-01',
	base: { needsBP: 5000, wantsBP: 3000, investBP: 2000 },
	marginal: { needsBP: 2000, wantsBP: 3000, investBP: 5000 }
};

/** Increments from the real workbook's Budget tab, 2022..2030. */
const WORKBOOK = [3050, 9050, 1111, 5085, 540, 1000, 1000, 1000, 1000];

/** The realized shares those increments produced, 2021..2030. */
const EXPECTED: [number, number, number][] = [
	[5000, 3000, 2000],
	[4299, 3000, 2701],
	[3207, 3000, 3793],
	[3086, 3000, 3914],
	[2720, 3000, 4280],
	[2683, 3000, 4317],
	[2621, 3000, 4379],
	[2565, 3000, 4435],
	[2513, 3000, 4487],
	[2467, 3000, 4533]
];

const sum = (t: TripleBP) => t.needsBP + t.wantsBP + t.investBP;

describe('weightsAfter', () => {
	it('reproduces the real workbook trajectory', () => {
		for (let y = 0; y < EXPECTED.length; y++) {
			const w = weightsAfter(POLICY, WORKBOOK.slice(0, y));
			expect([w.needsBP, w.wantsBP, w.investBP], `year ${2021 + y}`).toEqual(EXPECTED[y]);
		}
	});

	it('always sums to exactly 10000 across the trajectory', () => {
		for (let y = 0; y <= WORKBOOK.length; y++) {
			expect(sum(weightsAfter(POLICY, WORKBOOK.slice(0, y)))).toBe(10000);
		}
	});

	it('returns the base weights when there are no promotions', () => {
		expect(weightsAfter(POLICY, [])).toEqual(POLICY.base);
	});

	it('pins wants at 30% forever, because it is 30% of base and margin alike', () => {
		for (let y = 0; y <= WORKBOOK.length; y++) {
			expect(weightsAfter(POLICY, WORKBOOK.slice(0, y)).wantsBP).toBe(3000);
		}
	});

	it('moves wants when the marginal policy says it should', () => {
		const shrinking: Policy = {
			...POLICY,
			marginal: { needsBP: 2000, wantsBP: 2000, investBP: 6000 }
		};
		// The pin is policy, not hard-coding: a lower marginal wants drags the share down.
		expect(weightsAfter(shrinking, [10000]).wantsBP).toBeLessThan(3000);
	});

	it('is order-independent in aggregate: two raises equal their compounded product', () => {
		// 10% then 20% compounds to 32%, so both must land on identical weights.
		expect(weightsAfter(POLICY, [1000, 2000])).toEqual(weightsAfter(POLICY, [3200]));
	});

	it('converges onto the marginal split as growth compounds', () => {
		// 100 raises of 10% put F at ~13781, which drives (base − marginal)/F
		// below half a basis point — the weights land exactly on the asymptote.
		expect(weightsAfter(POLICY, Array(100).fill(1000))).toEqual({
			needsBP: 2000,
			wantsBP: 3000,
			investBP: 5000
		});
	});
});

describe('roundTripleBP', () => {
	it('leaves exact integers untouched', () => {
		expect(roundTripleBP([5000, 3000, 2000])).toEqual([5000, 3000, 2000]);
	});

	it('hands the leftover unit to the largest fractional part', () => {
		// floors are 3206/3000/3793 = 9999; needs has the largest remainder (.74)
		expect(roundTripleBP([3206.74, 3000, 3793.26])).toEqual([3207, 3000, 3793]);
	});

	it('breaks ties by bucket order, deterministically', () => {
		const out = roundTripleBP([3333.34, 3333.33, 3333.33]);
		expect(out).toEqual([3334, 3333, 3333]);
		expect(out[0] + out[1] + out[2]).toBe(10000);
	});

	it('distributes two leftover units to the two largest remainders', () => {
		// floors are 3333/3333/3332 = 9998, so two units go out: .7 and .7 beat .6
		expect(roundTripleBP([3333.7, 3333.7, 3332.6])).toEqual([3334, 3334, 3332]);
	});
});

describe('assertTriple', () => {
	it('accepts a triple summing to 10000', () => {
		expect(() =>
			assertTriple({ needsBP: 5000, wantsBP: 3000, investBP: 2000 }, 'Base')
		).not.toThrow();
	});

	it('rejects one that does not, naming the offender', () => {
		expect(() => assertTriple({ needsBP: 5000, wantsBP: 3000, investBP: 1000 }, 'Base')).toThrow(
			/Base.*100/
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/budget-policy.spec.ts`
Expected: FAIL — cannot resolve `./budget-policy`

- [ ] **Step 3: Write the implementation**

Create `src/lib/server/budget-policy.ts`:

```ts
/**
 * How the base salary splits, and how each raise splits.
 *
 * A raise of fraction g moves every bucket's share by
 *     share' = (share + marginal × g) / (1 + g)
 * which folds over a promotion history into a drift-free closed form in the
 * cumulative growth factor F = Π (1 + gᵢ):
 *     share  = marginal + (base − marginal) / F
 *
 * The salary never appears, so a promotion percentage alone determines the
 * weights. F and the intermediate shares are dimensionless ratios — the only
 * floats in this feature. They never touch money: the output is integer basis
 * points and every rupee figure still goes through integer mulBP.
 */

export interface TripleBP {
	needsBP: number;
	wantsBP: number;
	investBP: number;
}

export interface Policy {
	baseEffectiveFrom: string;
	base: TripleBP;
	marginal: TripleBP;
}

export const TOTAL_BP = 10000;

export function assertTriple(t: TripleBP, label: string): void {
	const total = t.needsBP + t.wantsBP + t.investBP;
	if (total !== TOTAL_BP)
		throw new Error(`${label} must sum to 100% (got ${(total / 100).toFixed(2)}%).`);
}

/**
 * Rounds three exact basis-point shares to integers summing to exactly 10000,
 * which the budget_periods CHECK constraint requires.
 *
 * Largest remainder: floor all three, then hand the leftover units to the
 * largest fractional parts. Because each floor loses under one unit, there are
 * never more than two to hand out. Ties go to the earlier bucket so the result
 * is deterministic.
 */
export function roundTripleBP(exact: [number, number, number]): [number, number, number] {
	const floors = exact.map(Math.floor) as [number, number, number];
	const leftover = TOTAL_BP - (floors[0] + floors[1] + floors[2]);
	const byRemainder = exact
		.map((value, index) => ({ frac: value - floors[index], index }))
		.sort((a, b) => b.frac - a.frac || a.index - b.index);

	const out: [number, number, number] = [...floors];
	for (let k = 0; k < leftover; k++) out[byRemainder[k].index] += 1;
	return out;
}

/** Weights after folding the given raises, in basis points, over the policy. */
export function weightsAfter(policy: Policy, incrementsBP: number[]): TripleBP {
	let f = 1;
	for (const increment of incrementsBP) f *= 1 + increment / TOTAL_BP;

	const share = (base: number, marginal: number) => marginal + (base - marginal) / f;
	const [needsBP, wantsBP, investBP] = roundTripleBP([
		share(policy.base.needsBP, policy.marginal.needsBP),
		share(policy.base.wantsBP, policy.marginal.wantsBP),
		share(policy.base.investBP, policy.marginal.investBP)
	]);
	return { needsBP, wantsBP, investBP };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/budget-policy.spec.ts`
Expected: PASS, all cases. If the workbook trajectory fails, the fold is wrong — do not adjust the expected values, they are ground truth measured from the real sheet.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/budget-policy.ts src/lib/server/budget-policy.spec.ts
git commit -m "feat(budgets): salary-free weight fold from promotion history"
```

---

### Task 3: `monthStart` date helper

**Files:**

- Modify: `src/lib/dates.ts`
- Test: `src/lib/dates.spec.ts` (create if absent; check with `ls src/lib/dates.spec.ts` first)

**Interfaces:**

- Consumes: nothing
- Produces: `function monthStart(iso: string): string`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/dates.spec.ts`, or create it with the imports below if it does not exist:

```ts
import { describe, expect, it } from 'vitest';
import { monthStart } from './dates';

describe('monthStart', () => {
	it('snaps a mid-month date to the first of that month', () => {
		expect(monthStart('2025-09-15')).toBe('2025-09-01');
	});

	it('leaves a first-of-month date alone', () => {
		expect(monthStart('2025-09-01')).toBe('2025-09-01');
	});

	it('handles December without rolling the year', () => {
		expect(monthStart('2025-12-31')).toBe('2025-12-01');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dates.spec.ts`
Expected: FAIL — `monthStart` is not exported

- [ ] **Step 3: Write the implementation**

Append to `src/lib/dates.ts`:

```ts
/**
 * The first of the month containing an ISO date. A raise landing mid-month
 * applies to that whole month's pay, so promotions snap here.
 */
export function monthStart(iso: string): string {
	return `${iso.slice(0, 7)}-01`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dates.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.spec.ts
git commit -m "feat(dates): month-start helper for mid-month effective dates"
```

---

### Task 4: Period precedence in `budgets.ts`

**Files:**

- Modify: `src/lib/server/budgets.ts:5-57`
- Test: `src/lib/server/budgets.spec.ts`

**Interfaces:**

- Consumes: `budget_periods.source` from Task 1
- Produces:
  - `Period` gains `source: 'base' | 'promotion' | 'manual'`
  - `listPeriods` and `activeFor` order by `effective_from DESC`, then precedence `manual > promotion > base`, then `id DESC`
  - `function periodFor(periods: Period[], date: string): Period | null` — in-memory equivalent of `activeFor`, for callers that already hold the list

- [ ] **Step 1: Write the failing test**

Append to `src/lib/server/budgets.spec.ts`:

```ts
import { periodFor } from './budgets';

describe('period precedence', () => {
	const insert = (
		effectiveFrom: string,
		needsBP: number,
		source: 'base' | 'promotion' | 'manual',
		promotionId: number | null = null
	) =>
		db
			.prepare(
				`INSERT INTO budget_periods
				   (effective_from, needs_bp, wants_bp, invest_bp, source, promotion_id)
				 VALUES (?, ?, 3000, ?, ?, ?)`
			)
			.run(effectiveFrom, needsBP, 10000 - needsBP - 3000, source, promotionId);

	it('prefers a manual row over a generated one on the same date', () => {
		insert('2025-01-01', 2720, 'base');
		insert('2025-01-01', 3500, 'manual');
		expect(activeFor(db, '2025-06-01')?.needsBP).toBe(3500);
	});

	it('prefers a promotion row over a base row on the same date', () => {
		insert('2025-01-01', 5000, 'base');
		insert('2025-01-01', 2720, 'promotion', null);
		expect(activeFor(db, '2025-06-01')?.needsBP).toBe(2720);
	});

	it('still prefers a later date over a higher-precedence earlier one', () => {
		insert('2025-01-01', 3500, 'manual');
		insert('2025-06-01', 2720, 'promotion', null);
		expect(activeFor(db, '2025-09-01')?.needsBP).toBe(2720);
	});

	it('reports the source it picked', () => {
		insert('2025-01-01', 5000, 'base');
		expect(activeFor(db, '2025-06-01')?.source).toBe('base');
	});

	it('periodFor matches activeFor without touching the database', () => {
		insert('2024-01-01', 5000, 'base');
		insert('2025-01-01', 3500, 'manual');
		insert('2025-01-01', 2720, 'promotion', null);
		const periods = listPeriods(db);
		for (const date of ['2023-01-01', '2024-06-01', '2025-06-01']) {
			expect(periodFor(periods, date)?.needsBP ?? null).toBe(activeFor(db, date)?.needsBP ?? null);
		}
	});
});
```

Task 1's `CHECK ((source = 'promotion') = (promotion_id IS NOT NULL))` rejects a `promotion` row with a null `promotion_id`, so those tests need a real promotion to point at. Add this helper inside the same `describe` block and use it wherever a `'promotion'` row is inserted — each test gets a fresh database from `beforeEach`, so a fixed date is safe and keeps the test deterministic:

```ts
const promoId = (effectiveDate: string) =>
	Number(
		db
			.prepare('INSERT INTO promotions (effective_date, increment_bp) VALUES (?, ?)')
			.run(effectiveDate, 2000).lastInsertRowid
	);
```

Then replace every `insert(…, 'promotion', null)` above with `insert(…, 'promotion', promoId('2025-01-01'))`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/budgets.spec.ts`
Expected: FAIL — `periodFor` is not exported, and `source` is missing from `Period`

- [ ] **Step 3: Write the implementation**

In `src/lib/server/budgets.ts`, add `source` to the interface, extract the shared ordering, and add `periodFor`:

```ts
export type PeriodSource = 'base' | 'promotion' | 'manual';

export interface Period {
	id: number;
	effectiveFrom: string;
	needsBP: number;
	wantsBP: number;
	investBP: number;
	source: PeriodSource;
}

/**
 * On a shared effective date a hand-typed correction beats a generated row,
 * and a promotion beats the base. Kept identical in SQL and in memory so
 * periodFor and activeFor can never disagree.
 */
const PRECEDENCE_SQL = `CASE source WHEN 'manual' THEN 2 WHEN 'promotion' THEN 1 ELSE 0 END`;
const ORDER_SQL = `ORDER BY effective_from DESC, ${PRECEDENCE_SQL} DESC, id DESC`;

const SELECT_SQL = `SELECT id, effective_from, needs_bp, wants_bp, invest_bp, source
                    FROM budget_periods`;

export function listPeriods(db: DatabaseSync): Period[] {
	const rows = db.prepare(`${SELECT_SQL} ${ORDER_SQL}`).all() as Record<string, unknown>[];
	return rows.map(mapPeriod);
}

export function activeFor(db: DatabaseSync, date: string): Period | null {
	const row = db
		.prepare(`${SELECT_SQL} WHERE effective_from <= ? ${ORDER_SQL} LIMIT 1`)
		.get(date) as Record<string, unknown> | undefined;
	return row ? mapPeriod(row) : null;
}

/**
 * The period in force on a date, from an already-fetched list. listPeriods
 * returns rows in the same precedence order activeFor applies, so the first
 * match wins — this lets a caller resolve twelve months with zero extra queries.
 */
export function periodFor(periods: Period[], date: string): Period | null {
	return periods.find((p) => p.effectiveFrom <= date) ?? null;
}
```

Extend `mapPeriod` to carry the source:

```ts
function mapPeriod(r: Record<string, unknown>): Period {
	return {
		id: r.id as number,
		effectiveFrom: r.effective_from as string,
		needsBP: r.needs_bp as number,
		wantsBP: r.wants_bp as number,
		investBP: r.invest_bp as number,
		source: r.source as PeriodSource
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/server/budgets.spec.ts && npm run check`
Expected: PASS and 0 type errors. `createPeriod` needs no change — `source` defaults to `'manual'` in SQL.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/budgets.ts src/lib/server/budgets.spec.ts
git commit -m "feat(budgets): source-aware period precedence and in-memory lookup"
```

---

### Task 5: Promotions domain and the projection rebuild

**Files:**

- Create: `src/lib/server/promotions.ts`
- Create: `src/lib/server/promotions.spec.ts`

**Interfaces:**

- Consumes: `weightsAfter`, `assertTriple`, `Policy`, `TripleBP` (Task 2); `monthStart` (Task 3)
- Produces:
  - `interface Promotion { id: number; effectiveDate: string; incrementBP: number; note: string | null }`
  - `function getPolicy(db): Policy`
  - `function updatePolicy(db, p: Policy): void`
  - `function listPromotions(db): Promotion[]` — newest first
  - `function createPromotion(db, p: { effectiveDate: string; incrementBP: number; note?: string | null }): number`
  - `function deletePromotion(db, id: number): void`
  - `function rebuildProjectedPeriods(db): void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/promotions.spec.ts`:

```ts
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { activeFor, listPeriods } from './budgets';
import {
	createPromotion,
	deletePromotion,
	getPolicy,
	listPromotions,
	rebuildProjectedPeriods,
	updatePolicy
} from './promotions';
import { testDb } from './test-db';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

describe('getPolicy', () => {
	it('reads the seeded 50/30/20 base and 20/30/50 margin', () => {
		expect(getPolicy(db)).toEqual({
			baseEffectiveFrom: '2021-09-01',
			base: { needsBP: 5000, wantsBP: 3000, investBP: 2000 },
			marginal: { needsBP: 2000, wantsBP: 3000, investBP: 5000 }
		});
	});
});

describe('createPromotion', () => {
	it('projects a period at the month start of the effective date', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		const period = activeFor(db, '2022-09-01');
		expect(period?.effectiveFrom).toBe('2022-09-01');
		expect(period?.source).toBe('promotion');
		expect([period?.needsBP, period?.wantsBP, period?.investBP]).toEqual([4299, 3000, 2701]);
	});

	it('leaves months before the promotion on the base weights', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		expect(activeFor(db, '2022-08-01')?.needsBP).toBe(5000);
	});

	it('rejects a bad date, a non-positive raise and a duplicate date', () => {
		expect(() => createPromotion(db, { effectiveDate: '15-09-2022', incrementBP: 3050 })).toThrow(
			/YYYY-MM-DD/
		);
		expect(() => createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 0 })).toThrow(
			/greater than zero/
		);
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		expect(() => createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 1000 })).toThrow();
	});

	it('compounds two promotions inside one year', () => {
		createPromotion(db, { effectiveDate: '2025-03-01', incrementBP: 1000 });
		createPromotion(db, { effectiveDate: '2025-09-01', incrementBP: 2000 });

		// Between them, only the 10% has landed: 0.2 + 0.3/1.1 = 0.47273
		expect(activeFor(db, '2025-06-01')?.needsBP).toBe(4727);
		// After both, 10% then 20% compounds to 32%: 0.2 + 0.3/1.32 = 0.42727
		const after = activeFor(db, '2025-10-01');
		expect([after?.needsBP, after?.wantsBP, after?.investBP]).toEqual([4273, 3000, 2727]);
	});

	it('collapses two promotions in the same month into one period, compounded', () => {
		createPromotion(db, { effectiveDate: '2025-03-05', incrementBP: 1000 });
		createPromotion(db, { effectiveDate: '2025-03-20', incrementBP: 2000 });
		const march = listPeriods(db).filter((p) => p.effectiveFrom === '2025-03-01');
		expect(march).toHaveLength(1);
		expect(march[0].needsBP).toBe(4273);
	});

	it('handles a two-year gap with no promotion', () => {
		createPromotion(db, { effectiveDate: '2023-09-01', incrementBP: 5000 });
		expect(activeFor(db, '2024-06-01')?.needsBP).toBe(activeFor(db, '2025-06-01')?.needsBP);
	});
});

describe('rebuildProjectedPeriods', () => {
	it('is idempotent', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		const before = listPeriods(db).map((p) => `${p.effectiveFrom}:${p.needsBP}:${p.source}`);
		rebuildProjectedPeriods(db);
		rebuildProjectedPeriods(db);
		expect(listPeriods(db).map((p) => `${p.effectiveFrom}:${p.needsBP}:${p.source}`)).toEqual(
			before
		);
	});

	it('never touches manual rows', () => {
		db.prepare(
			`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp)
			 VALUES ('2024-03-01', 3500, 3000, 3500)`
		).run();
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		rebuildProjectedPeriods(db);
		const manual = listPeriods(db).filter((p) => p.source === 'manual');
		expect(manual).toHaveLength(1);
		expect(manual[0].needsBP).toBe(3500);
	});

	it('always emits a base period', () => {
		rebuildProjectedPeriods(db);
		const base = listPeriods(db).filter((p) => p.source === 'base');
		expect(base).toHaveLength(1);
		expect(base[0].effectiveFrom).toBe('2021-09-01');
		expect(base[0].needsBP).toBe(5000);
	});
});

describe('deletePromotion', () => {
	it('removes the promotion and reprojects the rest', () => {
		const first = createPromotion(db, { effectiveDate: '2022-09-01', incrementBP: 3050 });
		createPromotion(db, { effectiveDate: '2023-09-01', incrementBP: 9050 });
		expect(activeFor(db, '2024-01-01')?.needsBP).toBe(3207);

		deletePromotion(db, first);
		expect(listPromotions(db)).toHaveLength(1);
		// Only the 90.5% raise remains: 0.2 + 0.3/1.905 = 0.3575
		expect(activeFor(db, '2024-01-01')?.needsBP).toBe(3575);
	});
});

describe('updatePolicy', () => {
	it('reprojects every period when the marginal split changes', () => {
		createPromotion(db, { effectiveDate: '2022-09-01', incrementBP: 3050 });
		updatePolicy(db, {
			baseEffectiveFrom: '2021-09-01',
			base: { needsBP: 5000, wantsBP: 3000, investBP: 2000 },
			marginal: { needsBP: 5000, wantsBP: 3000, investBP: 2000 }
		});
		// Marginal equal to base means the split never moves.
		expect(activeFor(db, '2023-01-01')?.needsBP).toBe(5000);
	});

	it('rejects triples that do not sum to 100%', () => {
		expect(() =>
			updatePolicy(db, {
				baseEffectiveFrom: '2021-09-01',
				base: { needsBP: 5000, wantsBP: 3000, investBP: 1000 },
				marginal: { needsBP: 2000, wantsBP: 3000, investBP: 5000 }
			})
		).toThrow(/Base.*100/);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/promotions.spec.ts`
Expected: FAIL — cannot resolve `./promotions`

- [ ] **Step 3: Write the implementation**

Create `src/lib/server/promotions.ts`:

```ts
import type { DatabaseSync } from 'node:sqlite';
import { monthStart } from '$lib/dates';
import { assertTriple, weightsAfter, type Policy } from './budget-policy';

export interface Promotion {
	id: number;
	effectiveDate: string;
	incrementBP: number;
	note: string | null;
}

export function getPolicy(db: DatabaseSync): Policy {
	const r = db
		.prepare(
			`SELECT base_effective_from, base_needs_bp, base_wants_bp, base_invest_bp,
			        marg_needs_bp, marg_wants_bp, marg_invest_bp
			 FROM budget_policy WHERE id = 1`
		)
		.get() as Record<string, unknown>;
	return {
		baseEffectiveFrom: r.base_effective_from as string,
		base: {
			needsBP: r.base_needs_bp as number,
			wantsBP: r.base_wants_bp as number,
			investBP: r.base_invest_bp as number
		},
		marginal: {
			needsBP: r.marg_needs_bp as number,
			wantsBP: r.marg_wants_bp as number,
			investBP: r.marg_invest_bp as number
		}
	};
}

export function updatePolicy(db: DatabaseSync, p: Policy): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(p.baseEffectiveFrom))
		throw new Error('Base effective-from must be YYYY-MM-DD.');
	assertTriple(p.base, 'Base split');
	assertTriple(p.marginal, 'Raise split');

	inTransaction(db, () => {
		db.prepare(
			`UPDATE budget_policy SET base_effective_from = ?,
			   base_needs_bp = ?, base_wants_bp = ?, base_invest_bp = ?,
			   marg_needs_bp = ?, marg_wants_bp = ?, marg_invest_bp = ?
			 WHERE id = 1`
		).run(
			p.baseEffectiveFrom,
			p.base.needsBP,
			p.base.wantsBP,
			p.base.investBP,
			p.marginal.needsBP,
			p.marginal.wantsBP,
			p.marginal.investBP
		);
		project(db);
	});
}

/** Newest first, matching how the settings page lists them. */
export function listPromotions(db: DatabaseSync): Promotion[] {
	const rows = db
		.prepare(
			`SELECT id, effective_date, increment_bp, note
			 FROM promotions ORDER BY effective_date DESC`
		)
		.all() as Record<string, unknown>[];
	return rows.map((r) => ({
		id: r.id as number,
		effectiveDate: r.effective_date as string,
		incrementBP: r.increment_bp as number,
		note: (r.note as string | null) ?? null
	}));
}

export function createPromotion(
	db: DatabaseSync,
	p: { effectiveDate: string; incrementBP: number; note?: string | null }
): number {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(p.effectiveDate))
		throw new Error('Effective date must be YYYY-MM-DD.');
	if (!Number.isInteger(p.incrementBP) || p.incrementBP <= 0)
		throw new Error('Raise must be greater than zero.');

	return inTransaction(db, () => {
		const result = db
			.prepare('INSERT INTO promotions (effective_date, increment_bp, note) VALUES (?, ?, ?)')
			.run(p.effectiveDate, p.incrementBP, p.note ?? null);
		project(db);
		return Number(result.lastInsertRowid);
	});
}

export function deletePromotion(db: DatabaseSync, id: number): void {
	inTransaction(db, () => {
		// The period row goes with it via ON DELETE CASCADE; project() rebuilds
		// the rest, since every later period's weights depended on this raise.
		db.prepare('DELETE FROM promotions WHERE id = ?').run(id);
		project(db);
	});
}

export function rebuildProjectedPeriods(db: DatabaseSync): void {
	inTransaction(db, () => project(db));
}

function inTransaction<T>(db: DatabaseSync, fn: () => T): T {
	db.exec('BEGIN');
	try {
		const out = fn();
		db.exec('COMMIT');
		return out;
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}
}

/**
 * Rewrites every generated period from the promotion log. Manual rows are left
 * alone, so a hand-typed correction survives any number of rebuilds.
 *
 * Two promotions inside one month collapse to a single period carrying both
 * raises: the month is the finest granularity the monthly view resolves, and
 * the later promotion's cumulative fold already includes the earlier one.
 *
 * Caller must hold a transaction.
 */
function project(db: DatabaseSync): void {
	const policy = getPolicy(db);
	const ascending = listPromotions(db).reverse();

	db.exec(`DELETE FROM budget_periods WHERE source IN ('base', 'promotion')`);

	const insert = db.prepare(
		`INSERT INTO budget_periods
		   (effective_from, needs_bp, wants_bp, invest_bp, source, promotion_id)
		 VALUES (?, ?, ?, ?, ?, ?)`
	);

	const base = weightsAfter(policy, []);
	insert.run(policy.baseEffectiveFrom, base.needsBP, base.wantsBP, base.investBP, 'base', null);

	const increments: number[] = [];
	const byMonth = new Map<
		string,
		{ needsBP: number; wantsBP: number; investBP: number; id: number }
	>();
	for (const promotion of ascending) {
		increments.push(promotion.incrementBP);
		// Later promotions in the same month overwrite earlier ones, keeping the
		// fully compounded weights and the last promotion as the owning row.
		byMonth.set(monthStart(promotion.effectiveDate), {
			...weightsAfter(policy, increments),
			id: promotion.id
		});
	}

	for (const [effectiveFrom, w] of byMonth)
		insert.run(effectiveFrom, w.needsBP, w.wantsBP, w.investBP, 'promotion', w.id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/server/promotions.spec.ts`
Expected: PASS. If the compounding assertions (`4273`, `3575`) fail, verify by hand: `0.2 + 0.3/1.32 = 0.42727…` → 4273 bp, and `0.2 + 0.3/1.905 = 0.35748…` → 3575 bp.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/promotions.ts src/lib/server/promotions.spec.ts
git commit -m "feat(budgets): promotion log projecting budget periods"
```

---

### Task 6: Kill the yearly N+1 and add yearly allocation

**Files:**

- Modify: `src/lib/server/ledger.ts:179-193` (add alongside `monthlyActuals`)
- Modify: `src/lib/server/budgets.ts` (append)
- Test: `src/lib/server/ledger.spec.ts`, `src/lib/server/budgets.spec.ts`

**Interfaces:**

- Consumes: `periodFor`, `Period`, `allocate` (Task 4); `MonthlyActuals` (existing)
- Produces:
  - `interface MonthActuals extends MonthlyActuals { month: number }`
  - `function monthlyActualsForYear(db, year: number): MonthActuals[]`
  - `interface YearlyBucketRow { bucket: 'needs' | 'wants' | 'investments'; label: string; allocated: Paise; actual: Paise; variance: Paise; effectiveBP: number | null }`
  - `interface YearlyAllocation { income: Paise; rows: YearlyBucketRow[]; unallocated: Paise }`
  - `function yearlyAllocation(periods: Period[], months: MonthActuals[], year: number): YearlyAllocation`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/server/ledger.spec.ts` (reuse whatever transaction-insert helper the file already defines; check its top before writing):

```ts
describe('monthlyActualsForYear', () => {
	it('returns one row per month with data, matching monthlyActuals exactly', () => {
		addIncome('2025-01-10', fromRupees(100000));
		addOutflow('2025-01-15', fromRupees(30000), 'needs');
		addIncome('2025-06-10', fromRupees(120000));
		addOutflow('2025-06-15', fromRupees(20000), 'wants');

		const rows = monthlyActualsForYear(db, 2025);
		expect(rows.map((r) => r.month)).toEqual([1, 6]);
		for (const row of rows) {
			const one = monthlyActuals(db, 2025, row.month);
			expect({ ...row, month: undefined }).toEqual({ ...one, month: undefined });
		}
	});

	it('returns nothing for a year with no transactions', () => {
		expect(monthlyActualsForYear(db, 2019)).toEqual([]);
	});

	it('does not bleed across year boundaries', () => {
		addIncome('2024-12-31', fromRupees(100000));
		addIncome('2025-01-01', fromRupees(200000));
		expect(monthlyActualsForYear(db, 2025).map((r) => r.month)).toEqual([1]);
	});
});
```

Append to `src/lib/server/budgets.spec.ts`:

```ts
describe('yearlyAllocation', () => {
	const months = [
		{ month: 1, income: fromRupees(100000), needs: fromRupees(30000), wants: 0, invest: 0 },
		{ month: 9, income: fromRupees(100000), needs: fromRupees(20000), wants: 0, invest: 0 }
	];

	it('applies each month its own weights, not the year-end ones', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createPeriod(db, { effectiveFrom: '2025-09-01', needsBP: 3000, wantsBP: 3000, investBP: 4000 });
		const y = yearlyAllocation(listPeriods(db), months, 2025);

		// 50% of Jan + 30% of Sep, not 30% of both.
		const needs = y.rows.find((r) => r.bucket === 'needs')!;
		expect(needs.allocated).toBe(fromRupees(50000) + fromRupees(30000));
	});

	it('reports a blended effective rate between the two period rates', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createPeriod(db, { effectiveFrom: '2025-09-01', needsBP: 3000, wantsBP: 3000, investBP: 4000 });
		const needs = yearlyAllocation(listPeriods(db), months, 2025).rows.find(
			(r) => r.bucket === 'needs'
		)!;
		expect(needs.effectiveBP).toBe(4000); // exactly halfway on equal income
	});

	it('reports variance as actual minus allocated', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		const needs = yearlyAllocation(listPeriods(db), months, 2025).rows.find(
			(r) => r.bucket === 'needs'
		)!;
		expect(needs.actual).toBe(fromRupees(50000));
		expect(needs.variance).toBe(needs.actual - needs.allocated);
	});

	it('surfaces income that never reached a bucket', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		const y = yearlyAllocation(listPeriods(db), months, 2025);
		// 200000 in, 50000 tracked across buckets
		expect(y.income).toBe(fromRupees(200000));
		expect(y.unallocated).toBe(fromRupees(150000));
	});

	it('allocates nothing for months before any period exists', () => {
		createPeriod(db, { effectiveFrom: '2026-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		const y = yearlyAllocation(listPeriods(db), months, 2025);
		expect(y.rows.every((r) => r.allocated === 0)).toBe(true);
		expect(y.rows.every((r) => r.effectiveBP === 0)).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/server/ledger.spec.ts src/lib/server/budgets.spec.ts`
Expected: FAIL — `monthlyActualsForYear` and `yearlyAllocation` are not exported

- [ ] **Step 3: Write the implementations**

Append to `src/lib/server/ledger.ts`, next to `monthlyActuals`:

```ts
export interface MonthActuals extends MonthlyActuals {
	month: number;
}

/**
 * Every month of a year that has data, in one pass. The yearly view needs all
 * twelve; querying per month made that page issue a query per month.
 */
export function monthlyActualsForYear(db: DatabaseSync, year: number): MonthActuals[] {
	const [start, end] = dateRange(year);
	return db
		.prepare(
			`SELECT CAST(substr(date, 6, 2) AS INTEGER) AS month,
			   COALESCE(SUM(CASE WHEN direction = 'income' AND income_source IN ('job', 'side_hustle')
			                     THEN amount_paise ELSE 0 END), 0) AS income,
			   COALESCE(SUM(CASE WHEN bucket = 'needs' THEN amount_paise ELSE 0 END), 0) AS needs,
			   COALESCE(SUM(CASE WHEN bucket = 'wants' THEN amount_paise ELSE 0 END), 0) AS wants,
			   COALESCE(SUM(CASE WHEN bucket = 'investments' THEN amount_paise ELSE 0 END), 0) AS invest
			 FROM transactions WHERE date >= ? AND date < ?
			 GROUP BY month ORDER BY month`
		)
		.all(start, end) as unknown as MonthActuals[];
}
```

Append to `src/lib/server/budgets.ts`:

```ts
import type { MonthActuals } from './ledger';

export interface YearlyBucketRow {
	bucket: 'needs' | 'wants' | 'investments';
	label: string;
	allocated: Paise;
	actual: Paise;
	/** actual − allocated: positive means overspent against plan. */
	variance: Paise;
	/** allocated ÷ income, in basis points. null when there was no income. */
	effectiveBP: number | null;
}

export interface YearlyAllocation {
	income: Paise;
	rows: YearlyBucketRow[];
	/** Income that never reached a bucket — the gap plan-vs-actual hides. */
	unallocated: Paise;
}

/**
 * Sums each month's own allocation rather than applying one rate to the year.
 * With a promotion mid-year the two differ, and only this one is right: the
 * months before the raise were budgeted at the old split.
 *
 * Pure over already-fetched rows, so the page costs one grouped query plus one
 * period fetch however many months have data.
 */
export function yearlyAllocation(
	periods: Period[],
	months: MonthActuals[],
	year: number
): YearlyAllocation {
	const mm = (m: number) => String(m).padStart(2, '0');
	let income = 0;
	const allocated = { needs: 0, wants: 0, invest: 0 };
	const actual = { needs: 0, wants: 0, invest: 0 };

	for (const month of months) {
		income += month.income;
		actual.needs += month.needs;
		actual.wants += month.wants;
		actual.invest += month.invest;

		const period = periodFor(periods, `${year}-${mm(month.month)}-01`);
		if (!period) continue;
		const share = allocate(month.income, period);
		allocated.needs += share.needs;
		allocated.wants += share.wants;
		allocated.invest += share.invest;
	}

	const effective = (a: Paise) => (income === 0 ? null : Math.round((a * 10000) / income));
	const rows: YearlyBucketRow[] = (
		[
			['needs', 'Needs', allocated.needs, actual.needs],
			['wants', 'Wants', allocated.wants, actual.wants],
			['investments', 'Investments', allocated.invest, actual.invest]
		] as const
	).map(([bucket, label, alloc, act]) => ({
		bucket,
		label,
		allocated: alloc,
		actual: act,
		variance: act - alloc,
		effectiveBP: effective(alloc)
	}));

	return {
		income,
		rows,
		unallocated: income - (actual.needs + actual.wants + actual.invest)
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/server/ && npm run check`
Expected: PASS, 0 type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/ledger.ts src/lib/server/budgets.ts src/lib/server/ledger.spec.ts src/lib/server/budgets.spec.ts
git commit -m "perf(yearly): grouped month rollup and per-month yearly allocation"
```

---

### Task 7: Settings page — policy and promotions

> **Superseded by Task 13 of `docs/superpowers/plans/2026-08-04-ui-redesign.md`, which is done.**

**Files:**

- Modify: `src/routes/settings/budget/+page.server.ts`
- Modify: `src/routes/settings/budget/+page.svelte`
- Test: `src/routes/pages.spec.ts`

**Interfaces:**

- Consumes: `getPolicy`, `updatePolicy`, `listPromotions`, `createPromotion`, `deletePromotion` (Task 5); `listPeriods`, `activeFor` (Task 4)
- Produces: named form actions `savePolicy`, `addPromotion`, `deletePromotion`, `addPeriod` on `/settings/budget`

- [ ] **Step 1: Write the failing test**

Append to `src/routes/pages.spec.ts`, following the existing load/action test style in that file:

```ts
describe('/settings/budget promotions', () => {
	it('loads policy, promotions and periods together', async () => {
		const data = await budgetLoad({ locals: { db } } as never);
		expect(data.policy.marginal.investBP).toBe(5000);
		expect(data.promotions).toEqual([]);
		expect(data.periods.some((p: { source: string }) => p.source === 'base')).toBe(true);
	});

	it('addPromotion projects a period and redirects', async () => {
		const form = new FormData();
		form.set('effective_date', '2025-09-15');
		form.set('increment', '20');
		await expect(
			budgetActions.addPromotion({
				request: new Request('http://x', { method: 'POST', body: form }),
				locals: { db }
			} as never)
		).rejects.toMatchObject({ status: 303 });
		expect(activeFor(db, '2025-09-01')?.source).toBe('promotion');
	});

	it('addPromotion reports a bad raise without throwing', async () => {
		const form = new FormData();
		form.set('effective_date', '2025-09-15');
		form.set('increment', '0');
		const result = await budgetActions.addPromotion({
			request: new Request('http://x', { method: 'POST', body: form }),
			locals: { db }
		} as never);
		expect(result).toMatchObject({ status: 400 });
	});
});
```

Import `budgetLoad` and `budgetActions` at the top of the file the same way the existing budget-settings tests import them; if there are none, add:

```ts
import { load as budgetLoad, actions as budgetActions } from './settings/budget/+page.server';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/routes/pages.spec.ts`
Expected: FAIL — `data.policy` is undefined and `budgetActions.addPromotion` is not a function

- [ ] **Step 3: Rewrite the page server**

Replace `src/routes/settings/budget/+page.server.ts` entirely:

```ts
import { todayISO } from '$lib/dates';
import { parsePercentBP } from '$lib/money';
import { activeFor, createPeriod, listPeriods } from '$lib/server/budgets';
import {
	createPromotion,
	deletePromotion,
	getPolicy,
	listPromotions,
	updatePolicy
} from '$lib/server/promotions';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	return {
		policy: getPolicy(locals.db),
		promotions: listPromotions(locals.db),
		periods: listPeriods(locals.db),
		activeId: activeFor(locals.db, todayISO())?.id ?? null,
		today: todayISO()
	};
};

/** Form values as plain strings, for re-rendering what was typed on failure. */
async function values(request: Request): Promise<Record<string, string>> {
	const form = await request.formData();
	return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

export const actions: Actions = {
	savePolicy: async ({ request, locals }) => {
		const v = await values(request);
		try {
			updatePolicy(locals.db, {
				baseEffectiveFrom: v.base_effective_from,
				base: {
					needsBP: parsePercentBP(v.base_needs || ''),
					wantsBP: parsePercentBP(v.base_wants || ''),
					investBP: parsePercentBP(v.base_invest || '')
				},
				marginal: {
					needsBP: parsePercentBP(v.marg_needs || ''),
					wantsBP: parsePercentBP(v.marg_wants || ''),
					investBP: parsePercentBP(v.marg_invest || '')
				}
			});
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : String(err), values: v });
		}
		redirect(303, '/settings/budget');
	},

	addPromotion: async ({ request, locals }) => {
		const v = await values(request);
		try {
			createPromotion(locals.db, {
				effectiveDate: v.effective_date,
				incrementBP: parsePercentBP(v.increment || ''),
				note: v.note?.trim() || null
			});
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : String(err), values: v });
		}
		redirect(303, '/settings/budget');
	},

	deletePromotion: async ({ request, locals }) => {
		const v = await values(request);
		try {
			deletePromotion(locals.db, Number(v.id));
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : String(err), values: v });
		}
		redirect(303, '/settings/budget');
	},

	addPeriod: async ({ request, locals }) => {
		const v = await values(request);
		try {
			createPeriod(locals.db, {
				effectiveFrom: v.effective_from,
				needsBP: parsePercentBP(v.needs || ''),
				wantsBP: parsePercentBP(v.wants || ''),
				investBP: parsePercentBP(v.invest || '')
			});
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : String(err), values: v });
		}
		redirect(303, '/settings/budget');
	}
};
```

Note the previously-default action is now named `addPeriod`; the existing manual-period form in the `.svelte` file must change to `action="?/addPeriod"`.

- [ ] **Step 4: Update the page markup**

In `src/routes/settings/budget/+page.svelte`, keep the existing manual-period form (retargeted to `?/addPeriod`) and add two sections above it. Match the file's existing table/form classes rather than inventing new ones — read the current markup first and reuse its structure.

```svelte
<section>
	<h2>Raise policy</h2>
	<p class="hint">
		The base split applies to your starting salary; the raise split decides where each promotion
		goes. Because investments take the larger marginal share, its share of income climbs as you earn
		more — settling at {formatBP(data.policy.marginal.investBP)} eventually.
	</p>
	<form method="POST" action="?/savePolicy" use:enhance>
		<input type="date" name="base_effective_from" value={data.policy.baseEffectiveFrom} required />
		<input name="base_needs" value={(data.policy.base.needsBP / 100).toFixed(2)} required />
		<input name="base_wants" value={(data.policy.base.wantsBP / 100).toFixed(2)} required />
		<input name="base_invest" value={(data.policy.base.investBP / 100).toFixed(2)} required />
		<input name="marg_needs" value={(data.policy.marginal.needsBP / 100).toFixed(2)} required />
		<input name="marg_wants" value={(data.policy.marginal.wantsBP / 100).toFixed(2)} required />
		<input name="marg_invest" value={(data.policy.marginal.investBP / 100).toFixed(2)} required />
		<button type="submit">Save policy</button>
	</form>
</section>

<section>
	<h2>Promotions</h2>
	<form method="POST" action="?/addPromotion" use:enhance>
		<input type="date" name="effective_date" value={data.today} required />
		<input name="increment" placeholder="20.00" inputmode="decimal" required />
		<input name="note" placeholder="note" />
		<button type="submit">Log promotion</button>
	</form>

	<table>
		<thead>
			<tr>
				<th>Effective</th>
				<th class="num">Raise</th>
				<th class="num">Needs</th>
				<th class="num">Wants</th>
				<th class="num">Invest</th>
				<th>Note</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.promotions as promotion (promotion.id)}
				{@const period = data.periods.find((p) => p.promotionId === promotion.id)}
				<tr>
					<td>{promotion.effectiveDate}</td>
					<td class="num">{formatBP(promotion.incrementBP)}</td>
					<td class="num">{period ? formatBP(period.needsBP) : '—'}</td>
					<td class="num">{period ? formatBP(period.wantsBP) : '—'}</td>
					<td class="num">{period ? formatBP(period.investBP) : '—'}</td>
					<td>{promotion.note ?? ''}</td>
					<td>
						<form method="POST" action="?/deletePromotion" use:enhance>
							<input type="hidden" name="id" value={promotion.id} />
							<button type="submit" aria-label="Delete promotion">
								<Icon name="trash-2" />
							</button>
						</form>
					</td>
				</tr>
			{:else}
				<tr><td colspan="7">No promotions logged yet.</td></tr>
			{/each}
		</tbody>
	</table>
</section>
```

The `{@const period = …}` lookup needs `promotionId` on the `Period` type. Add it in `src/lib/server/budgets.ts`: select `promotion_id` in `SELECT_SQL`, add `promotionId: number | null` to the interface, and map `promotionId: (r.promotion_id as number | null) ?? null` in `mapPeriod`. Show the `source` as a badge in the existing periods table.

If `trash-2` is not already in `src/lib/components/Icon.svelte`, add its Lucide path there — do not introduce a second icon set or an emoji.

- [ ] **Step 5: Run tests and gates**

Run: `npx vitest run src/routes/pages.spec.ts && npm run check && npm run lint`
Expected: PASS, 0 type errors, lint clean

- [ ] **Step 6: Commit**

```bash
git add src/routes/settings/budget src/lib/server/budgets.ts src/lib/components/Icon.svelte src/routes/pages.spec.ts
git commit -m "feat(settings): log promotions and edit the raise policy"
```

---

### Task 8: Yearly page — allocated, variance, effective rate, unallocated

> **Superseded by Task 12 of `docs/superpowers/plans/2026-08-04-ui-redesign.md`, which is done.**
> It shipped `variance` as **Remaining** and "effective rate" as **Allocated share** — see the
> spec's § UI note.

**Files:**

- Modify: `src/routes/yearly/+page.server.ts`
- Modify: `src/routes/yearly/+page.svelte`
- Test: `src/routes/pages.spec.ts`

**Interfaces:**

- Consumes: `monthlyActualsForYear` (Task 6), `yearlyAllocation` (Task 6), `listPeriods` (Task 4)
- Produces: `/yearly` load returning `{ year, years, summary, months, allocation }`

- [ ] **Step 1: Write the failing test**

Append to `src/routes/pages.spec.ts`:

```ts
describe('/yearly allocation', () => {
	it('returns per-bucket allocation and unallocated income', async () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		addIncome('2025-01-10', fromRupees(100000));
		addOutflow('2025-01-15', fromRupees(30000), 'needs');

		const data = await yearlyLoad({
			locals: { db },
			url: new URL('http://x/yearly?year=2025')
		} as never);

		const needs = data.allocation.rows.find((r: { bucket: string }) => r.bucket === 'needs');
		expect(needs.allocated).toBe(fromRupees(50000));
		expect(needs.actual).toBe(fromRupees(30000));
		expect(needs.variance).toBe(fromRupees(-20000));
		expect(data.allocation.unallocated).toBe(fromRupees(70000));
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/routes/pages.spec.ts`
Expected: FAIL — `data.allocation` is undefined

- [ ] **Step 3: Rewrite the page server**

Replace `src/routes/yearly/+page.server.ts`:

```ts
import { todayISO } from '$lib/dates';
import { listPeriods, yearlyAllocation } from '$lib/server/budgets';
import { monthlyActualsForYear, years, yearlySummary } from '$lib/server/ledger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const allYears = years(locals.db);
	const fallback = allYears.at(-1) ?? Number(todayISO().slice(0, 4));
	const year = Number(url.searchParams.get('year')) || fallback;

	// One grouped query for every month, one for the periods — the whole page
	// stays flat however many months have data.
	const months = monthlyActualsForYear(locals.db, year);

	return {
		year,
		years: allYears,
		summary: yearlySummary(locals.db, year),
		months,
		allocation: yearlyAllocation(listPeriods(locals.db), months, year)
	};
};
```

The `months` shape changed from `{ month, actuals }` to a flat `MonthActuals`. Update every reference in `+page.svelte` from `m.actuals.income` to `m.income` (and likewise `needs`/`wants`/`invest`).

- [ ] **Step 4: Update the page markup**

Add an allocation table above the existing per-month table, reusing the file's existing classes:

```svelte
<table>
	<thead>
		<tr>
			<th>Bucket</th>
			<th class="num">Allocated</th>
			<th class="num">Actual</th>
			<th class="num">Variance</th>
			<th class="num">Effective</th>
		</tr>
	</thead>
	<tbody>
		{#each data.allocation.rows as row (row.bucket)}
			<tr>
				<td>{row.label}</td>
				<td class="num">{formatMoney(row.allocated)}</td>
				<td class="num">{formatMoney(row.actual)}</td>
				<td class="num" class:over={row.variance > 0}>{formatMoney(row.variance)}</td>
				<td class="num">{row.effectiveBP === null ? '—' : formatBP(row.effectiveBP)}</td>
			</tr>
		{/each}
	</tbody>
	<tfoot>
		<tr>
			<td>Unallocated</td>
			<td class="num" colspan="4">{formatMoney(data.allocation.unallocated)}</td>
		</tr>
	</tfoot>
</table>
```

Unallocated is the headline honesty figure — income that never reached a bucket. Give it the same visual weight as a bucket row, not a footnote.

- [ ] **Step 5: Run tests and gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean

- [ ] **Step 6: Commit**

```bash
git add src/routes/yearly src/routes/pages.spec.ts
git commit -m "feat(yearly): allocation, variance and unallocated income"
```

---

### Task 9: Documentation

> **Superseded by Task 14 of `docs/superpowers/plans/2026-08-04-ui-redesign.md`, which is done.**

**Files:**

- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

**Interfaces:**

- Consumes: everything above
- Produces: docs matching reality, per the project's documentation rule

- [ ] **Step 1: Update ARCHITECTURE.md**

In the module map, add:

```
src/lib/server/budget-policy.ts — pure weight fold: base + marginal splits folded over a
                                 promotion history via share = marginal + (base − marginal)/F;
                                 largest-remainder rounding to bp summing to 10000
src/lib/server/promotions.ts   — promotion log + policy row; projects budget_periods
                                 transactionally (base + one row per promotion month)
```

In the data model section, replace the `budget_periods` bullet with:

```
- **budget_policy / promotions / budget_periods** — promotions are the event log (effective
  date + raise in bp); `budget_policy` holds the base and marginal splits. `budget_periods` is
  a projection rebuilt from both: one `base` row, one `promotion` row per month containing a
  promotion, plus any `manual` rows typed by hand. On a shared date, precedence is
  manual > promotion > base. Weights need no salary figure — the fold is scale-free.
```

Add a decisions note:

```
**Why promotions, not years.** The source workbook indexed weights by calendar year and
assumed one raise effective 1 January. Real raises land mid-year, twice a year, or not for
two years; modelling them as January events overstated planned cash by two-thirds of every
increment. Keying on effective date makes all three cases fall out for free.
```

- [ ] **Step 2: Update README.md**

Add to the features list:

```
- **Promotions drive the split.** Log a raise (date + %) and the Needs/Wants/Investments
  weights re-derive themselves from that point on. Raises are split 20/30/50 by default, so
  the investment share climbs as you earn more without you re-planning anything. Monthly
  allocations follow the weights in force that month; yearly figures roll up from monthly.
```

- [ ] **Step 3: Verify the whole suite and commit**

Run: `npm run check && npm run lint && npm test`
Expected: all clean

```bash
git add README.md ARCHITECTURE.md
git commit -m "docs: promotion-driven weights in readme and architecture"
```

---

## Self-Review

**Spec coverage**

| Spec section                                                        | Task |
| ------------------------------------------------------------------- | ---- |
| `budget_policy`, `promotions`, `budget_periods` rebuild, precedence | 1, 4 |
| Closed-form fold, largest-remainder rounding, money-rule compliance | 2    |
| Month-start snapping for mid-month raises                           | 3, 5 |
| `getPolicy`/`updatePolicy`/CRUD/`rebuildProjectedPeriods`           | 5    |
| `monthlyActualsForYear` N+1 fix                                     | 6    |
| `yearlyAllocation` + blended effective rate                         | 6    |
| Settings UI: policy, promotions, source badges                      | 7    |
| Yearly UI: allocated/actual/variance/effective + unallocated        | 8    |
| Error handling via `fail(400, …)`                                   | 7, 8 |
| Docs                                                                | 9    |

**Deviations from the spec, deliberate**

1. `getPolicy`/`updatePolicy` live in `promotions.ts`, not `budgets.ts` — avoids an import cycle. Explained under File Structure.
2. `yearlyAllocation` takes `(periods, months, year)` rather than `(db, year)`. It becomes pure and lets the page reuse the grouped rollup instead of re-querying, which is what makes the "4 queries" claim true.
3. `Period` gains `promotionId` as well as `source` — the settings table needs it to show each promotion's resulting weights.
4. Two promotions in the same month collapse to one period carrying both raises. The spec did not cover this; the `UNIQUE(effective_from, source)` constraint forces a decision, and compounding is the correct one.

**Type consistency check:** `TripleBP`, `Policy`, `Promotion`, `Period`, `PeriodSource`, `MonthActuals`, `YearlyBucketRow`, `YearlyAllocation` are each defined once and referenced with the same field names throughout. `weightsAfter` returns `TripleBP`, which spreads directly into the period insert. `periodFor` and `activeFor` share `ORDER_SQL` so they cannot drift.
