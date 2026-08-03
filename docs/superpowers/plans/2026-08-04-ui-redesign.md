# Freyr UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Freyr's six screens so the app answers "can I spend this?" at a glance, and close every divergence between `DESIGN.md` and `src/app.css`.

**Architecture:** Presentation _rules_ (the money-zero convention, the delta triple) become pure functions in `src/lib/` where they can be unit-tested; _appearance_ stays hand-written CSS classes in the single `src/app.css`; Svelte components appear only where non-trivial markup genuinely repeats across pages. No new dependencies, no client-side data fetching, no new color tokens.

**Tech Stack:** Node ≥ 22.13, TypeScript, SvelteKit 2 / Svelte 5 (runes), `node:sqlite`, Vitest, hand-written CSS.

**Spec:** `docs/superpowers/specs/2026-08-04-ui-redesign-design.md`

## Global Constraints

- **Money is integer paise, never floats.** All parsing, arithmetic and formatting goes through `src/lib/money.ts`. Percentages are integer basis points.
- **No new dependencies.** Not one. Reach for Node stdlib, SvelteKit built-ins, or the browser.
- **No new color tokens.** The palette is closed. `--c1`…`--c5` are explicitly out of scope.
- **Server-rendered only.** `load` + form actions with `use:enhance`. No client-side data fetching, no client state libraries.
- **There is no component test environment.** `vite.config.ts` defines exactly one Vitest project — `server`, `environment: 'node'` — and it _excludes_ `src/**/*.svelte.{test,spec}.{js,ts}`. Do not attempt to write component tests and **do not add a browser project or jsdom to make them possible.** `.svelte` files are verified by `npm run check` (svelte-check) plus the page `load`/action tests in `src/routes/pages.spec.ts`. This constraint is _why_ the rules live in pure functions.
- **`expect: { requireAssertions: true }`** is set. Every `it()` must assert something.
- **Both themes in the same commit.** A token or rule added for light without its dark counterpart is an unfinished change.
- **Gates:** `npm run check`, `npm run lint`, `npm test` must all be clean before each commit. `npm run lint` runs `prettier --check . && eslint .` — run `npm run format` before committing if prettier complains.
- **Commit style:** [Conventional Commits](https://www.conventionalcommits.org) — `type(scope): summary`, imperative and lowercase.
- **Never add a `Co-Authored-By` trailer** to any commit in this repository.
- **Accessibility is not optional:** visible `:focus-visible` rings, `aria-label` on every icon-only control, real `<th scope>`, color never the sole carrier of meaning.

---

## Prerequisite Gate

**Tasks 9 and 10 of this plan are blocked** until Tasks 5 and 6 of `docs/superpowers/plans/2026-08-03-promotion-driven-weights.md` are complete. Those tasks produce the promotions domain and the yearly allocation rollup, which the redesigned yearly and budget-settings pages consume. Tasks 1–8 and 11 of this plan touch none of that data and may proceed immediately.

Do **not** re-implement the promotions domain here. It has its own spec and plan.

This plan **supersedes** Tasks 7 and 8 of that plan; when this plan's Tasks 9 and 10 land, mark those two as done.

---

## File Structure

**Created:**

| File                                 | Responsibility                                               |
| ------------------------------------ | ------------------------------------------------------------ |
| `src/lib/format.ts`                  | Presentation rules: money-cell zero/sign, delta triple       |
| `src/lib/format.spec.ts`             | Tests for the above                                          |
| `src/lib/server/txn-form.ts`         | Form-values → `createTransaction`, shared by ledger and home |
| `src/lib/server/txn-form.spec.ts`    | Tests for the above                                          |
| `src/lib/components/Money.svelte`    | A money figure with its zero and sign convention             |
| `src/lib/components/Delta.svelte`    | A signed change: arrow + color + sign                        |
| `src/lib/components/Meter.svelte`    | Progress track, including the overflow segment               |
| `src/lib/components/EntryBar.svelte` | The transaction-add form, shared by home and ledger          |

**Modified:**

| File                                                  | Change                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `src/lib/dates.ts` / `.spec.ts`                       | `daysInMonth`, `dayBoundIn`                                 |
| `src/lib/progress.ts` / `.spec.ts`                    | `Meter.overflow`                                            |
| `src/lib/server/ledger.ts` / `.spec.ts`               | `TxnFilter.limit`; `through` on the two rollups             |
| `src/app.css`                                         | `.hero`, `.delta`, meter overflow, topbar title, auth air   |
| `src/lib/components/Icon.svelte`                      | `layout-dashboard`; rename `sliders` → `sliders-horizontal` |
| `src/routes/+layout.svelte`                           | Topbar page title, corrected rail icons                     |
| `src/routes/+page.{svelte,server.ts}`                 | The command center                                          |
| `src/routes/ledger/+page.{svelte,server.ts}`          | Adopt shared components                                     |
| `src/routes/monthly/+page.{svelte,server.ts}`         | Deltas, stepper keys                                        |
| `src/routes/yearly/+page.{svelte,server.ts}`          | Compact rollup, allocation columns                          |
| `src/routes/settings/budget/+page.{svelte,server.ts}` | Policy + promotions                                         |
| `src/routes/{login,setup}/+page.svelte`               | Mark size                                                   |
| `src/routes/pages.spec.ts`                            | Home action + new load shapes                               |
| `README.md`, `ARCHITECTURE.md`, `DESIGN.md`           | Reflect reality                                             |

---

### Task 1: Presentation rules — `format.ts`

The money-zero rule and the delta triple currently live nowhere, which is why `₹0.00` ships on the yearly page. One module, pure, no DOM, no server imports.

**Files:**

- Create: `src/lib/format.ts`
- Create: `src/lib/format.spec.ts`

**Interfaces:**

- Consumes: `formatMoney`, `Paise` from `$lib/money`
- Produces:
  - `type Flow = 'income' | 'outflow'`
  - `interface DeltaView { klass: 'pos' | 'neg' | 'flat'; arrow: '▲' | '▼' | '—'; text: string }`
  - `function formatCell(p: Paise, direction?: Flow): string`
  - `function delta(current: Paise, previous: Paise, opts?: { lowerIsBetter?: boolean }): DeltaView`

`Flow` is declared locally rather than imported from `$lib/server/ledger`. SvelteKit forbids importing `$lib/server/*` into code that reaches the client, and `format.ts` does. The two are structurally identical, so `formatCell(t.amountPaise, t.direction)` type-checks without a cast.

- [ ] **Step 1: Write the failing test**

Create `src/lib/format.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { delta, formatCell } from './format';

describe('formatCell', () => {
	it('renders zero as an em dash, never as ₹0.00', () => {
		expect(formatCell(0)).toBe('—');
		expect(formatCell(0, 'income')).toBe('—');
		expect(formatCell(0, 'outflow')).toBe('—');
	});

	it('renders an outflow bare', () => {
		expect(formatCell(125050)).toBe('₹1,250.50');
		expect(formatCell(125050, 'outflow')).toBe('₹1,250.50');
	});

	it('marks an inflow with an explicit plus', () => {
		expect(formatCell(125050, 'income')).toBe('+₹1,250.50');
	});

	it('does not stack a plus onto a negative', () => {
		expect(formatCell(-125050, 'income')).toBe('-₹1,250.50');
	});
});

describe('delta', () => {
	it('reports a rise as up and good by default', () => {
		expect(delta(50000, 30000)).toEqual({ klass: 'pos', arrow: '▲', text: '+₹200' });
	});

	it('reports a fall as down and bad by default', () => {
		expect(delta(30000, 50000)).toEqual({ klass: 'neg', arrow: '▼', text: '-₹200' });
	});

	it('reports no change as flat', () => {
		expect(delta(50000, 50000)).toEqual({ klass: 'flat', arrow: '—', text: '—' });
	});

	// The whole reason the option exists: spending more is bad news, but the
	// movement is still upward. The arrow reports direction; the class reports
	// whether that direction is good.
	it('keeps the arrow up but flips the class when lower is better', () => {
		expect(delta(50000, 30000, { lowerIsBetter: true })).toEqual({
			klass: 'neg',
			arrow: '▲',
			text: '+₹200'
		});
	});

	it('keeps the arrow down but flips the class when lower is better', () => {
		expect(delta(30000, 50000, { lowerIsBetter: true })).toEqual({
			klass: 'pos',
			arrow: '▼',
			text: '-₹200'
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format.spec.ts`
Expected: FAIL — `Failed to resolve import "./format"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/format.ts`:

```ts
/**
 * Presentation rules for figures. Pure — no DOM, no server imports.
 *
 * These two rules are mandated by DESIGN.md and were previously re-derived at
 * every call site, which is how `₹0.00` ended up shipping on the yearly page.
 * Keeping them here means a page cannot get them wrong by omission.
 */

import { formatMoney, type Paise } from './money';

/**
 * Structurally identical to `Direction` in `$lib/server/ledger`, declared here
 * because `$lib/server/*` may not be imported into code that reaches the client.
 */
export type Flow = 'income' | 'outflow';

export interface DeltaView {
	klass: 'pos' | 'neg' | 'flat';
	arrow: '▲' | '▼' | '—';
	text: string;
}

/**
 * A money figure for a table cell. Zero renders as an em dash — "nothing here"
 * reads far faster than a zero in a dense column. Inflows carry an explicit
 * plus; outflows render bare (DESIGN.md § money-cell).
 */
export function formatCell(p: Paise, direction?: Flow): string {
	if (p === 0) return '—';
	if (direction === 'income' && p > 0) return `+${formatMoney(p)}`;
	return formatMoney(p);
}

/**
 * A signed change across three redundant channels — arrow, color class and an
 * explicit sign — so the meaning survives color blindness and grayscale.
 *
 * The arrow and the class are independent. The arrow always reports the
 * direction of the number: ▲ when it rose. The class reports whether that is
 * good news, which depends on the figure — spending more is bad, having more
 * left is good. `lowerIsBetter` inverts the class only, never the arrow.
 */
export function delta(
	current: Paise,
	previous: Paise,
	opts?: { lowerIsBetter?: boolean }
): DeltaView {
	const diff = current - previous;
	if (diff === 0) return { klass: 'flat', arrow: '—', text: '—' };

	const rose = diff > 0;
	const good = opts?.lowerIsBetter ? !rose : rose;

	return {
		klass: good ? 'pos' : 'neg',
		arrow: rose ? '▲' : '▼',
		text: rose ? `+${formatMoney(diff)}` : formatMoney(diff)
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/format.ts src/lib/format.spec.ts
git commit -m "feat(format): money-cell zero rule and the delta triple"
```

---

### Task 2: Meter overflow

`progress.ts` clamps an overspend to 100%, so 143% of budget looks identical to exactly on budget. DESIGN.md calls for an overflow segment past the cap.

The rendering keeps the track a fixed width and **rescales it to `pct`** when over: the portion up to the allocation and the excess beyond it are both drawn inside the track, separated by a hairline. That is literally "a segment past the cap" and it cannot overflow its table cell.

**Files:**

- Modify: `src/lib/progress.ts`
- Modify: `src/lib/progress.spec.ts`

**Interfaces:**

- Produces: `Meter` gains `overflow: number` — the percentage of the track occupied by the excess, `0` when at or under the cap. `width` becomes the portion up to the cap; the two always sum to ≤ 100.

- [ ] **Step 1: Update the existing tests and add the new ones**

Every existing assertion in `src/lib/progress.spec.ts` uses `toEqual` on the whole object, so all four break when the field is added. Replace the file's `describe` body entirely:

```ts
describe('meter', () => {
	it('returns null when there is nothing to measure against', () => {
		expect(meter(500, null)).toBeNull();
		expect(meter(500, undefined)).toBeNull();
		expect(meter(500, 0)).toBeNull();
		expect(meter(500, -100)).toBeNull();
	});

	it('reports brand state below 80%', () => {
		expect(meter(7900, 10000)).toEqual({ pct: 79, width: 79, overflow: 0, klass: '' });
	});

	it('warns from 80% up to and including 100%', () => {
		expect(meter(8000, 10000)).toEqual({ pct: 80, width: 80, overflow: 0, klass: 'warn' });
		expect(meter(10000, 10000)).toEqual({ pct: 100, width: 100, overflow: 0, klass: 'warn' });
	});

	it('keeps zero spend at zero rather than hiding the meter', () => {
		expect(meter(0, 10000)).toEqual({ pct: 0, width: 0, overflow: 0, klass: '' });
	});

	// Over the cap the track rescales to pct: the allocation occupies
	// 100/pct of it and the excess occupies the rest, so the overspend is
	// visible as a distinct segment instead of vanishing into a full bar.
	it('splits the track into allocation and excess when over', () => {
		expect(meter(20000, 10000)).toEqual({ pct: 200, width: 50, overflow: 50, klass: 'over' });
		expect(meter(14300, 10000)).toEqual({ pct: 143, width: 70, overflow: 30, klass: 'over' });
	});

	it('keeps width and overflow summing to the full track', () => {
		const m = meter(33333, 10000);
		expect(m!.width + m!.overflow).toBe(100);
	});

	it('never returns a negative width for a negative actual', () => {
		expect(meter(-500, 10000)).toEqual({ pct: -5, width: 0, overflow: 0, klass: '' });
	});
});
```

Note `meter(14300, 10000)`: `pct` is 143, `width` is `Math.round(10000 / 143)` = 70, so `overflow` is 30.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/progress.spec.ts`
Expected: FAIL — returned objects lack `overflow`.

- [ ] **Step 3: Write the implementation**

Replace the type and function in `src/lib/progress.ts`:

```ts
export type Meter = {
	/** True percentage, unclamped and rounded to whole percent. */
	pct: number;
	/** Width of the spend-up-to-allocation segment, as a percent of the track. */
	width: number;
	/** Width of the excess segment past the cap; 0 at or under the cap. */
	overflow: number;
	/** Modifier class for the meter element. */
	klass: '' | 'warn' | 'over';
};

export function meter(actual: number, allocated: number | null | undefined): Meter | null {
	if (allocated == null || allocated <= 0) return null;

	const pct = Math.round((actual / allocated) * 100);

	if (pct <= 100) {
		const klass = pct >= 80 ? 'warn' : '';
		return { pct, width: Math.max(0, pct), overflow: 0, klass };
	}

	// Rescale the track to pct so the allocation and the excess both fit
	// inside it. The bar is a glance; the number beside it is the truth.
	const width = Math.round((100 / pct) * 100);
	return { pct, width, overflow: 100 - width, klass: 'over' };
}
```

Update the module docstring's "clamped" sentence to describe the rescale.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/progress.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/progress.ts src/lib/progress.spec.ts
git commit -m "feat(progress): show the overspend past the allocation cap"
```

---

### Task 3: Date bounds for like-for-like comparison

Comparing a month in progress against a completed month is a lie. Both the home hero and the yearly page need "the same span of days, one period earlier", which means an exclusive upper date bound that clamps to the target month's own length — 31 March must compare against the whole of February, not against 3 March.

**Files:**

- Modify: `src/lib/dates.ts`
- Modify: `src/lib/dates.spec.ts`

**Interfaces:**

- Produces:
  - `function daysInMonth(year: number, month: number): number`
  - `function dayBoundIn(year: number, month: number, dayOfMonth: number): string` — exclusive `YYYY-MM-DD` bound covering days 1…`dayOfMonth` of that month, clamped to the month's length

- [ ] **Step 1: Write the failing test**

Append to `src/lib/dates.spec.ts`:

```ts
describe('daysInMonth', () => {
	it('knows month lengths including leap February', () => {
		expect(daysInMonth(2026, 1)).toBe(31);
		expect(daysInMonth(2026, 2)).toBe(28);
		expect(daysInMonth(2024, 2)).toBe(29);
		expect(daysInMonth(2026, 4)).toBe(30);
		expect(daysInMonth(2026, 12)).toBe(31);
	});
});

describe('dayBoundIn', () => {
	it('bounds the first N days of a month, exclusive', () => {
		expect(dayBoundIn(2026, 7, 4)).toBe('2026-07-05');
		expect(dayBoundIn(2026, 7, 1)).toBe('2026-07-02');
	});

	it('rolls to the next month when the whole month is covered', () => {
		expect(dayBoundIn(2026, 7, 31)).toBe('2026-08-01');
		expect(dayBoundIn(2026, 12, 31)).toBe('2027-01-01');
	});

	// 31 March has no counterpart in February; comparing "through the 31st"
	// must mean all of February, not three days of March.
	it('clamps a day the target month does not have', () => {
		expect(dayBoundIn(2026, 2, 31)).toBe('2026-03-01');
		expect(dayBoundIn(2024, 2, 30)).toBe('2024-03-01');
	});
});
```

Add `dayBoundIn` and `daysInMonth` to the existing import at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dates.spec.ts`
Expected: FAIL — `daysInMonth is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/dates.ts`:

```ts
function iso(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Number of days in a month. Day 0 of the next month is the last of this one. */
export function daysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

/**
 * Exclusive upper bound covering days 1…`dayOfMonth` of the given month, for
 * like-for-like comparison against a period in progress. The day is clamped to
 * the month's own length, so "through the 31st" of a February means all of it.
 */
export function dayBoundIn(year: number, month: number, dayOfMonth: number): string {
	const day = Math.min(dayOfMonth, daysInMonth(year, month));
	return iso(new Date(year, month - 1, day + 1));
}
```

`todayISO` can now be simplified to `return iso(new Date());` — do that too.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dates.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.spec.ts
git commit -m "feat(dates): day bounds for like-for-like period comparison"
```

---

### Task 4: Bounded and limited queries

Home needs a short recent-activity list; the deltas need the rollups to accept an upper date bound. Both are additions to existing single-statement queries — no new query shapes, no N+1, and the bound tightens the existing `idx_transactions_date` range rather than adding a scan.

**Files:**

- Modify: `src/lib/server/ledger.ts:93-97` (`TxnFilter`), `:107-133` (`listTransactions`), `:179-193` (`monthlyActuals`), `:203-223` (`yearlySummary`)
- Modify: `src/lib/server/ledger.spec.ts`

**Interfaces:**

- Produces:
  - `TxnFilter` gains `limit?: number`
  - `monthlyActuals(db, year: number, month: number, through?: string): MonthlyActuals`
  - `yearlySummary(db, year: number, through?: string): YearlySummary`

`through` is an **exclusive** `YYYY-MM-DD` bound, ignored when it falls outside the period.

- [ ] **Step 1: Write the failing tests**

Append these inside the existing `describe('rollups', …)` block in `src/lib/server/ledger.spec.ts`, so they reuse its `beforeEach` seed. That seed inserts July transactions on the 1st, 5th, 6th, 7th, 8th and 9th, plus one on 30 June.

```ts
it('monthlyActuals honours an exclusive through bound', () => {
	// Through the 8th, exclusive: the 1st, 5th, 6th and 7th only.
	const m = monthlyActuals(db, 2026, 7, '2026-07-08');
	expect(m).toEqual({
		income: 14520900,
		needs: 3000000,
		wants: 0,
		invest: 0
	});
});

it('ignores a through bound past the end of the month', () => {
	expect(monthlyActuals(db, 2026, 7, '2026-09-01')).toEqual(monthlyActuals(db, 2026, 7));
});

it('returns nothing for a through bound before the month starts', () => {
	expect(monthlyActuals(db, 2026, 7, '2026-06-01')).toEqual({
		income: 0,
		needs: 0,
		wants: 0,
		invest: 0
	});
});

it('yearlySummary honours an exclusive through bound', () => {
	// Only 30 June falls before 1 July.
	expect(yearlySummary(db, 2026, '2026-07-01')).toEqual({
		job: 0,
		sideHustle: 0,
		needs: 99900,
		wants: 0,
		invest: 0
	});
});

it('listTransactions limits to the newest rows', () => {
	const rows = listTransactions(db, { limit: 2 });
	expect(rows.map((r) => r.date)).toEqual(['2026-07-09', '2026-07-08']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/server/ledger.spec.ts`
Expected: FAIL — the `through` argument is ignored, so the bounded assertions return whole-month figures; `limit` is ignored, so seven rows come back.

- [ ] **Step 3: Write the implementation**

In `src/lib/server/ledger.ts`, add `limit` to the filter:

```ts
export interface TxnFilter {
	year?: number;
	month?: number;
	bucket?: Bucket;
	/** Newest-first cap, for short activity lists. Keeps the query constant-cost. */
	limit?: number;
}
```

In `listTransactions`, append the clause after the existing `ORDER BY` (inside the template literal) and push the parameter:

```ts
			 ORDER BY t.date DESC, t.id DESC
			 ${f.limit ? 'LIMIT ?' : ''}`
		)
		.all(...params, ...(f.limit ? [f.limit] : []))) as Record<string, unknown>[];
```

Add a shared helper above `monthlyActuals`:

```ts
/** Narrows a half-open range by an exclusive bound, ignoring one that falls outside. */
function capped(end: string, through?: string): string {
	return through && through < end ? through : end;
}
```

Then give both rollups the parameter:

```ts
export function monthlyActuals(
	db: DatabaseSync,
	year: number,
	month: number,
	through?: string
): MonthlyActuals {
	const [start, end] = dateRange(year, month);
	// … unchanged SQL …
		.get(start, capped(end, through)) as unknown as MonthlyActuals;
	return row;
}
```

```ts
export function yearlySummary(db: DatabaseSync, year: number, through?: string): YearlySummary {
	const [start, end] = dateRange(year);
	// … unchanged SQL …
		.get(start, capped(end, through)) as Record<string, number>;
	// … unchanged mapping …
}
```

A `through` before `start` yields `date >= start AND date < through` with `through <= start`, which matches nothing — the "returns nothing" test covers this.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/server/ledger.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/ledger.ts src/lib/server/ledger.spec.ts
git commit -m "feat(ledger): row limit and exclusive date bounds on the rollups"
```

---

### Task 5: Shared transaction-create path

Home is about to grow a `create` action identical to the ledger's. Extracting it first means there is one place where a transaction is built from form values, not two that drift.

**Files:**

- Create: `src/lib/server/txn-form.ts`
- Create: `src/lib/server/txn-form.spec.ts`
- Modify: `src/routes/ledger/+page.server.ts:48-78`

**Interfaces:**

- Consumes: `createTransaction`, `ensureCategory`, `TxnInput`, `Bucket`, `Direction`, `Source` from `./ledger`; `parseMoney` from `$lib/money`
- Produces: `function createFromForm(db: DatabaseSync, values: Record<string, string>): number` — throws on invalid input, exactly as the ledger action already relies on

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/txn-form.spec.ts`:

```ts
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGoal, ensureLocation } from './goals';
import { listTransactions } from './ledger';
import { testDb } from './test-db';
import { createFromForm } from './txn-form';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

describe('createFromForm', () => {
	it('builds a bucketed outflow and creates the category on the way', () => {
		createFromForm(db, {
			date: '2026-07-10',
			amount: '1,250.50',
			direction: 'outflow',
			bucket: 'wants',
			category: '  Eating out  ',
			note: '  dinner  '
		});

		const [txn] = listTransactions(db, {});
		expect(txn.amountPaise).toBe(125050);
		expect(txn.categoryName).toBe('Eating out');
		expect(txn.note).toBe('dinner');
		expect(txn.bucket).toBe('wants');
	});

	it('builds income with a source and no bucket', () => {
		createFromForm(db, {
			date: '2026-07-01',
			amount: '50000',
			direction: 'income',
			source: 'job',
			// A stale bucket value from the form must not stick to income.
			bucket: 'needs'
		});

		const [txn] = listTransactions(db, {});
		expect(txn.direction).toBe('income');
		expect(txn.bucket).toBeNull();
		expect(txn.incomeSource).toBe('job');
	});

	it('throws on an unparseable amount', () => {
		expect(() =>
			createFromForm(db, {
				date: '2026-07-10',
				amount: 'abc',
				direction: 'outflow',
				bucket: 'wants'
			})
		).toThrow(/amount/i);
	});

	it('carries a goal contribution with its location', () => {
		const goalId = createGoal(db, { name: 'Car', kind: 'goal' });
		const locationId = ensureLocation(db, 'Bank');

		createFromForm(db, {
			date: '2026-07-10',
			amount: '100',
			direction: 'outflow',
			bucket: 'investments',
			goal: String(goalId),
			location: String(locationId)
		});

		const [txn] = listTransactions(db, {});
		expect(txn.goalName).toBe('Car');
		expect(txn.locationName).toBe('Bank');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/txn-form.spec.ts`
Expected: FAIL — `Failed to resolve import "./txn-form"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/server/txn-form.ts`:

```ts
/**
 * One place where posted form values become a transaction. Both the ledger and
 * the home command centre write through here, so their validation, trimming and
 * category-creation behaviour cannot drift apart.
 */

import type { DatabaseSync } from 'node:sqlite';
import { parseMoney } from '$lib/money';
import {
	createTransaction,
	ensureCategory,
	type Bucket,
	type Direction,
	type Source,
	type TxnInput
} from './ledger';

/** Throws with a readable message on invalid input; callers turn that into a 400. */
export function createFromForm(db: DatabaseSync, values: Record<string, string>): number {
	const direction = values.direction as Direction;
	const categoryName = values.category?.trim();

	const input: TxnInput = {
		date: values.date,
		amountPaise: parseMoney(values.amount || ''),
		direction,
		bucket: direction === 'outflow' ? (values.bucket as Bucket) : undefined,
		incomeSource: direction === 'income' ? (values.source as Source) : undefined,
		note: values.note?.trim() || undefined,
		categoryId:
			direction === 'outflow' && categoryName ? ensureCategory(db, categoryName) : undefined,
		goalId: values.goal ? Number(values.goal) : undefined,
		locationId: values.location ? Number(values.location) : undefined
	};

	return createTransaction(db, input);
}
```

Then replace the body of the `create` action in `src/routes/ledger/+page.server.ts` with:

```ts
	create: async ({ request, locals, url }) => {
		const form = await request.formData();
		const values = Object.fromEntries(
			[...form.entries()].map(([k, v]) => [k, String(v)])
		) as Record<string, string>;

		try {
			createFromForm(locals.db, values);
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : String(err), values });
		}
		redirect(303, backTo(url));
	},
```

Update that file's imports: drop `parseMoney`, `createTransaction`, `ensureCategory`, and the `Bucket`/`Direction`/`Source`/`TxnInput` types if now unused; add `import { createFromForm } from '$lib/server/txn-form';`. Keep `listTransactions`, `listCategories`, `deleteTransaction` and the `Bucket` type used by `filtersFrom`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — including the pre-existing ledger action tests in `src/routes/pages.spec.ts`, which must still pass unchanged. That is the point of this task.

- [ ] **Step 5: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/txn-form.ts src/lib/server/txn-form.spec.ts src/routes/ledger/+page.server.ts
git commit -m "refactor(ledger): extract the form-to-transaction path for reuse"
```

---

### Task 6: Presentation components and their CSS

Three small components plus the CSS they need. No tests — there is no component test environment (see Global Constraints); `npm run check` is the gate, and the rules they render are already tested in Tasks 1 and 2.

**Files:**

- Create: `src/lib/components/Money.svelte`, `Delta.svelte`, `Meter.svelte`
- Modify: `src/app.css`

**Interfaces:**

- Consumes: `formatCell`, `delta`, `Flow` (Task 1); `Meter` type and `meter()` (Task 2)
- Produces:
  - `<Money value={paise} direction?={Flow} />`
  - `<Delta current={paise} previous={paise} lowerIsBetter?={boolean} label?={string} />`
  - `<Meter value={Meter | null} />`

- [ ] **Step 1: Create `Money.svelte`**

```svelte
<!--
  A money figure carrying DESIGN.md's money-cell convention: zero is an em dash
  in --ink-faint, an inflow is signed and green, an outflow is bare. The cell
  itself keeps `class="num amount"`; this owns only the value.
-->
<script lang="ts">
	import { formatCell, type Flow } from '$lib/format';
	import type { Paise } from '$lib/money';

	let { value, direction }: { value: Paise; direction?: Flow } = $props();
</script>

<span class:pos={direction === 'income' && value > 0} class:faint={value === 0}
	>{formatCell(value, direction)}</span
>
```

- [ ] **Step 2: Create `Delta.svelte`**

```svelte
<!--
  A signed change across three redundant channels — arrow, colour and sign — so
  the meaning survives colour blindness and grayscale (DESIGN.md § delta-cell).
  The arrow is aria-hidden because the signed text already says it out loud.
-->
<script lang="ts">
	import { delta } from '$lib/format';
	import type { Paise } from '$lib/money';

	let {
		current,
		previous,
		lowerIsBetter = false,
		label
	}: { current: Paise; previous: Paise; lowerIsBetter?: boolean; label?: string } = $props();

	const d = $derived(delta(current, previous, { lowerIsBetter }));
</script>

<span class="delta {d.klass}">
	<span aria-hidden="true">{d.arrow}</span>{d.text}{#if label}<span class="muted">{label}</span
		>{/if}
</span>
```

- [ ] **Step 3: Create `Meter.svelte`**

```svelte
<!--
  The progress track. Under the cap it is one fill; over it the track rescales
  so the allocation and the excess are both visible, split by a hairline. Always
  rendered beside a text figure — the bar is a glance, the number is the truth.
-->
<script lang="ts">
	import type { Meter } from '$lib/progress';

	let { value }: { value: Meter | null } = $props();
</script>

{#if value}
	<span class="meter {value.klass}">
		<span class="fill" style="width:{value.width}%"></span>
		{#if value.overflow > 0}
			<span class="over-seg" style="width:{value.overflow}%"></span>
		{/if}
	</span>
{:else}
	<span class="faint">—</span>
{/if}
```

- [ ] **Step 4: Update the meter CSS and add the hero and delta rules**

In `src/app.css`, replace the whole `.meter` block (currently `.meter`, `.meter > span`, `.meter.warn > span`, `.meter.over > span`) with:

```css
.meter {
	display: inline-flex;
	vertical-align: middle;
	width: 8rem;
	max-width: 100%;
	height: 4px;
	background: var(--sunk);
	border-radius: var(--r-full);
	overflow: hidden;
}

.meter > .fill {
	height: 100%;
	background: var(--brand);
}

.meter.warn > .fill {
	background: var(--accent);
}

.meter.over > .fill {
	background: var(--loss);
}

/* The excess past the allocation cap. Same red at lower emphasis, split from
   the allocation by a hairline in the surface colour so the 100% line is
   visible rather than implied. */
.meter > .over-seg {
	height: 100%;
	background: var(--loss);
	opacity: 0.45;
	border-left: 1px solid var(--surface);
}
```

Add, after the `.kpi` block:

```css
/* ---- Hero & delta ------------------------------------------------------ */

.hero {
	display: flex;
	align-items: baseline;
	gap: var(--space-3);
	flex-wrap: wrap;
	margin: 0 0 var(--space-1);
}

.hero .figure {
	font-size: var(--t-hero);
	font-weight: 600;
	line-height: 1.15;
	letter-spacing: -0.01em;
	font-variant-numeric: tabular-nums;
}

.hero-sub {
	margin: 0 0 var(--space-4);
	font-size: var(--t-body);
	color: var(--ink-muted);
	font-variant-numeric: tabular-nums;
}

.delta {
	display: inline-flex;
	align-items: baseline;
	gap: var(--space-0);
	font-size: var(--t-body);
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.delta.pos {
	color: var(--gain);
}

.delta.neg {
	color: var(--loss);
}

.delta.flat {
	color: var(--ink-faint);
}

.delta .muted {
	margin-left: var(--space-1);
}

/* A meter and its figure share a line; the figure is the truth. */
.meter-cell {
	display: flex;
	align-items: center;
	gap: var(--space-2);
}

.meter-cell .pct {
	font-variant-numeric: tabular-nums;
	color: var(--ink-muted);
	min-width: 2.5rem;
	text-align: right;
}
```

Both themes are covered: every value above resolves through tokens that already have light and dark definitions. No new token is introduced.

- [ ] **Step 5: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean. The three components are unused so far, which is fine — `svelte-check` verifies them regardless.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/Money.svelte src/lib/components/Delta.svelte src/lib/components/Meter.svelte src/app.css
git commit -m "feat(ui): money, delta and meter components with the overflow track"
```

---

### Task 7: Shell — page title and corrected rail icons

DESIGN.md names `layout-dashboard` and `sliders-horizontal` for the rail, and says the mobile topbar carries the page title. The existing `sliders` entry is already byte-for-byte Lucide's `sliders-horizontal`, so that one is a rename; `layout-dashboard` is genuinely new artwork.

**Files:**

- Modify: `src/lib/components/Icon.svelte:8-65`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/app.css` (topbar title)

**Interfaces:**

- Produces: `Icon` accepts `layout-dashboard` and `sliders-horizontal`; `sliders` and `home` are removed

**Accessibility note:** the topbar title is a `<span>`, not a heading. The page's own `<h1>` stays visible on mobile, so the document keeps exactly one `h1` per page as DESIGN.md § Landmarks requires. On pages where the nav label and the `h1` coincide (Ledger) this reads as mild repetition; that is the correct trade against emitting two `h1`s or hiding the page heading.

- [ ] **Step 1: Add the new icon and rename the old one**

In `src/lib/components/Icon.svelte`, delete the `home` entry and add:

```ts
		'layout-dashboard': [
			'M4 3h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
			'M15 3h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
			'M15 12h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z',
			'M4 16h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z'
		],
```

Rename the `sliders` key to `'sliders-horizontal'`. Its path array is unchanged — it already matches upstream Lucide exactly.

- [ ] **Step 2: Wire the layout**

In `src/routes/+layout.svelte`, change the two nav tables and derive a title:

```ts
const nav = [
	{ href: '/', label: 'Home', icon: 'layout-dashboard' },
	{ href: '/ledger', label: 'Ledger', icon: 'list' },
	{ href: '/monthly', label: 'Monthly', icon: 'calendar' },
	{ href: '/yearly', label: 'Yearly', icon: 'calendar-range' }
];

const settings = [{ href: '/settings/budget', label: 'Budget', icon: 'sliders-horizontal' }];

function current(href: string): 'page' | undefined {
	if (href === '/') return page.url.pathname === '/' ? 'page' : undefined;
	return page.url.pathname.startsWith(href) ? 'page' : undefined;
}

// The mobile top bar carries the page title; on desktop the page h1 does
// that job and no top bar exists (DESIGN.md § topbar).
const title = $derived(
	[...nav, ...settings].find((item) => current(item.href) === 'page')?.label ?? 'Freyr'
);
```

Replace the topbar's wordmark with the title:

```svelte
<header class="topbar">
	<span class="topbar-title">{title}</span>
	<ThemeToggle theme={data.theme} class="" />
</header>
```

- [ ] **Step 3: Restyle the topbar title**

In `src/app.css`, inside the `@media (max-width: 40rem)` block, replace the `.topbar .wordmark` rule with:

```css
.topbar-title {
	font-size: var(--t-title);
	font-weight: 600;
}
```

- [ ] **Step 4: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean. `svelte-check` catches any remaining reference to the removed `home` or `sliders` names.

- [ ] **Step 5: Verify by eye**

Run: `npm run dev`, then check at a desktop width that the rail shows the four-panel dashboard glyph for Home and the sliders glyph for Budget, and at a phone width (device toolbar, 390px) that the top bar reads the current page's name.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/Icon.svelte src/routes/+layout.svelte src/app.css
git commit -m "feat(shell): page-title top bar and the spec'd rail icons"
```

---

### Task 8: Home — the command centre

The largest task. Home becomes hero + bucket instrument + entry bar + recent activity + a goals footer, with an honest state for the days before income lands.

**Files:**

- Create: `src/lib/components/EntryBar.svelte`
- Modify: `src/routes/+page.server.ts` (rewrite)
- Modify: `src/routes/+page.svelte` (rewrite)
- Modify: `src/routes/ledger/+page.svelte:57-150` (adopt `EntryBar`)
- Modify: `src/routes/pages.spec.ts`

**Interfaces:**

- Consumes: `formatCell` (Task 1), `meter` (Task 2), `dayBoundIn`/`daysInMonth` (Task 3), `monthlyActuals` with `through` and `listTransactions` with `limit` (Task 4), `createFromForm` (Task 5), `Money`/`Delta`/`Meter` (Task 6)
- Produces:
  - `/` load returns `{ summary, today, day, daysInMonth, prior: { label, spent }, spent, awaitingIncome, goals, lendingsOutstanding, recent, entry: { today, categories, goals, locations } }`
  - `/` gains a `create` action
  - `<EntryBar action={string} entry={…} values?={Record<string,string>} />`

- [ ] **Step 1: Write the failing test**

Append to `src/routes/pages.spec.ts`:

```ts
describe('home command centre', () => {
	// `/` always loads the real current month, so these seed relative to today
	// rather than at fixed dates that would drift out of range.
	const today = todayISO();
	const year = Number(today.slice(0, 4));
	const month = Number(today.slice(5, 7));

	it('compares this month against the same days of last month', () => {
		const prev = prevMonth(year, month);
		// The 1st of last month falls inside "through the same day" for any
		// day-of-month today can be.
		const prevFirst = `${prev.year}-${String(prev.month).padStart(2, '0')}-01`;
		createTransaction(db, {
			date: prevFirst,
			amountPaise: 800000,
			direction: 'outflow',
			bucket: 'needs'
		});

		const data = home.load(event('/')) as any;
		expect(data.prior.spent).toBe(800000);
		expect(data.prior.label).toBe(MONTH_NAMES[prev.month - 1]);
	});

	it('reports awaiting-income when no income is booked yet', () => {
		createPeriod(db, { effectiveFrom: '2020-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: today,
			amountPaise: 350000,
			direction: 'outflow',
			bucket: 'needs'
		});

		const data = home.load(event('/')) as any;
		expect(data.awaitingIncome).toBe(true);
		expect(data.spent).toBe(350000);
		// Allocation is a share of booked income, so zero income allocates zero
		// even with a period in force. `formatCell` renders that 0 as an em
		// dash, which is exactly the "nothing here yet" the state needs — no
		// special-casing in the markup.
		expect(data.summary.rows.every((r: any) => r.allocated === 0)).toBe(true);
	});

	it('clears awaiting-income once income lands', () => {
		createPeriod(db, { effectiveFrom: '2020-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: today,
			amountPaise: 10000000,
			direction: 'income',
			incomeSource: 'job'
		});

		const data = home.load(event('/')) as any;
		expect(data.awaitingIncome).toBe(false);
	});

	it('returns a bounded recent-activity list, newest first', () => {
		for (let d = 1; d <= 10; d++) {
			createTransaction(db, {
				date: `2026-01-${String(d).padStart(2, '0')}`,
				amountPaise: d * 1000,
				direction: 'outflow',
				bucket: 'needs'
			});
		}

		const data = home.load(event('/')) as any;
		expect(data.recent).toHaveLength(8);
		expect(data.recent[0].date).toBe('2026-01-10');
	});

	it('create action inserts and redirects home', async () => {
		await expect(
			home.actions.create(
				event('/?/create', {
					date: '2026-07-10',
					amount: '1,250.50',
					direction: 'outflow',
					bucket: 'wants',
					category: 'Eating out'
				})
			)
		).rejects.toSatisfy((e: unknown) => isRedirect(e) && e.location === '/');

		expect(listTransactions(db, {})).toHaveLength(1);
	});

	it('create action fails with the entered values preserved', async () => {
		const result = (await home.actions.create(
			event('/?/create', {
				date: '2026-07-10',
				amount: 'abc',
				direction: 'outflow',
				bucket: 'wants'
			})
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.values.amount).toBe('abc');
	});
});
```

Add `MONTH_NAMES`, `prevMonth` and `todayISO` to the file's `$lib/dates` import (add the import if the file has none).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/routes/pages.spec.ts`
Expected: FAIL — `data.prior` is undefined and `home.actions` does not exist.

- [ ] **Step 3: Rewrite the page server**

Replace `src/routes/+page.server.ts` entirely:

```ts
import { dayBoundIn, daysInMonth, MONTH_NAMES, prevMonth, todayISO } from '$lib/dates';
import { monthSummary } from '$lib/server/budgets';
import { goalProgress, listGoals, listLocations } from '$lib/server/goals';
import { listCategories, listTransactions, monthlyActuals } from '$lib/server/ledger';
import { openLendingsTotal } from '$lib/server/registry';
import { createFromForm } from '$lib/server/txn-form';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** How many rows the recent-activity list shows. Bounded so the query stays constant-cost. */
const RECENT = 8;

export const load: PageServerLoad = ({ locals }) => {
	const today = todayISO();
	const year = Number(today.slice(0, 4));
	const month = Number(today.slice(5, 7));
	const day = Number(today.slice(8, 10));

	const summary = monthSummary(locals.db, year, month);
	const spent = summary.rows.reduce((total, row) => total + row.actual, 0);

	// Like-for-like: a month in progress is compared against the same span of
	// days one month back, never against a completed month.
	const prev = prevMonth(year, month);
	const priorActuals = monthlyActuals(
		locals.db,
		prev.year,
		prev.month,
		dayBoundIn(prev.year, prev.month, day)
	);

	return {
		summary,
		today,
		day,
		daysInMonth: daysInMonth(year, month),
		spent,
		// Allocation derives from income actually booked, so before payday there
		// is nothing to allocate. Say so rather than showing every bucket as
		// overspent against a zero budget.
		awaitingIncome: summary.income === 0,
		prior: {
			label: MONTH_NAMES[prev.month - 1],
			spent: priorActuals.needs + priorActuals.wants + priorActuals.invest
		},
		goals: goalProgress(locals.db),
		lendingsOutstanding: openLendingsTotal(locals.db),
		recent: listTransactions(locals.db, { limit: RECENT }),
		entry: {
			today,
			categories: listCategories(locals.db),
			goals: listGoals(locals.db).filter((g) => g.status === 'active'),
			locations: listLocations(locals.db)
		}
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const values = Object.fromEntries(
			[...form.entries()].map(([k, v]) => [k, String(v)])
		) as Record<string, string>;

		try {
			createFromForm(locals.db, values);
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : String(err), values });
		}
		redirect(303, '/');
	}
};
```

- [ ] **Step 4: Extract the entry bar**

Create `src/lib/components/EntryBar.svelte`, moving the markup out of `src/routes/ledger/+page.svelte:57-150` verbatim apart from the parameterised action and the data source:

```svelte
<!--
  The transaction-add form. Shared by the ledger and the home command centre so
  the two cannot drift. It sits directly above the table it feeds, so a new row
  appears where the eye already is (DESIGN.md § entry-bar).
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Category } from '$lib/server/ledger';

	interface Named {
		id: number;
		name: string;
	}

	let {
		action,
		entry,
		values
	}: {
		action: string;
		entry: { today: string; categories: Category[]; goals: Named[]; locations: Named[] };
		values?: Record<string, string>;
	} = $props();

	let amountInput: HTMLInputElement | undefined = $state();
	let direction = $state('outflow');
</script>

<details class="entry-wrap" open>
	<summary>Add transaction</summary>
	<form
		class="entry"
		method="POST"
		{action}
		use:enhance={() =>
			async ({ update }) => {
				await update();
				amountInput?.focus();
			}}
	>
		<div class="field">
			<label for="e-date">Date</label>
			<input id="e-date" name="date" type="date" value={values?.date ?? entry.today} required />
		</div>
		<div class="field">
			<label for="e-amount">Amount ₹</label>
			<input
				id="e-amount"
				class="money"
				name="amount"
				bind:this={amountInput}
				value={values?.amount ?? ''}
				inputmode="decimal"
				autocomplete="off"
				required
			/>
		</div>
		<div class="field">
			<label for="e-direction">Direction</label>
			<select id="e-direction" name="direction" bind:value={direction}>
				<option value="outflow">Outflow</option>
				<option value="income">Income</option>
			</select>
		</div>
		{#if direction === 'outflow'}
			<div class="field">
				<label for="e-bucket">Bucket</label>
				<select id="e-bucket" name="bucket">
					<option value="needs">Needs</option>
					<option value="wants">Wants</option>
					<option value="investments">Investments</option>
				</select>
			</div>
			<div class="field">
				<label for="e-category">Category</label>
				<input id="e-category" name="category" list="categories" value={values?.category ?? ''} />
				<datalist id="categories">
					{#each entry.categories as c (c.id)}<option value={c.name}></option>{/each}
				</datalist>
			</div>
			<div class="field">
				<label for="e-goal">Goal</label>
				<select id="e-goal" name="goal">
					<option value="">—</option>
					{#each entry.goals as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="e-location">Location</label>
				<select id="e-location" name="location">
					<option value="">—</option>
					{#each entry.locations as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
				</select>
			</div>
		{:else}
			<div class="field">
				<label for="e-source">Source</label>
				<select id="e-source" name="source">
					<option value="job">Job</option>
					<option value="side_hustle">Side hustle</option>
					<option value="other">Other</option>
				</select>
			</div>
		{/if}
		<div class="field grow">
			<label for="e-note">Note</label>
			<input id="e-note" name="note" value={values?.note ?? ''} autocomplete="off" />
		</div>
		<button class="primary" type="submit">Add</button>
	</form>
</details>
```

In `src/routes/ledger/+page.svelte`, delete lines 57–150 and the now-unused `amountInput`/`direction` state and `enhance` import, and put in their place:

```svelte
<EntryBar action="?/create" entry={data.entry} values={form?.values} />
```

Add `import EntryBar from '$lib/components/EntryBar.svelte';` and, in `src/routes/ledger/+page.server.ts`, group the three reference lists under `entry` exactly as home does so the prop shapes match:

```ts
		entry: {
			today: todayISO(),
			categories: listCategories(locals.db),
			goals: listGoals(locals.db).filter((g) => g.status === 'active'),
			locations: listLocations(locals.db)
		}
```

Keep the top-level `today` key the ledger page already uses for its year list.

- [ ] **Step 5: Rewrite the home page markup**

Replace `src/routes/+page.svelte` entirely:

```svelte
<script lang="ts">
	import Delta from '$lib/components/Delta.svelte';
	import EntryBar from '$lib/components/EntryBar.svelte';
	import Meter from '$lib/components/Meter.svelte';
	import Money from '$lib/components/Money.svelte';
	import { monthLabel } from '$lib/dates';
	import { formatMoney } from '$lib/money';
	import { meter } from '$lib/progress';

	let { data, form } = $props();

	const s = $derived(data.summary);
	const allocated = $derived(s.rows.reduce((total, row) => total + (row.allocated ?? 0), 0));
	// One source for the headline and the table beneath it: the hero is the sum
	// of the rows' remaining, never an independently computed income − spent.
	const left = $derived(s.rows.reduce((total, row) => total + (row.remaining ?? 0), 0));
	const daysLeft = $derived(data.daysInMonth - data.day);
</script>

<svelte:head>
	<title>Home — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>{monthLabel(s.year, s.month)}</h1>
	<span class="muted">This month</span>
</div>

{#if data.awaitingIncome}
	<p class="hero">
		<span class="figure">{formatMoney(data.spent)} spent</span>
		<Delta
			current={data.spent}
			previous={data.prior.spent}
			lowerIsBetter
			label="vs {data.prior.label}"
		/>
	</p>
	<p class="hero-sub">Awaiting this month's income · {daysLeft} days remaining</p>
	<p class="notice">
		Allocations follow the income booked this month, and none is recorded yet. Buckets show what you
		have spent; targets appear once income lands.
	</p>
{:else}
	<p class="hero">
		<span class="figure">{formatMoney(left)} left</span>
		<!--
		  The headline is what remains; the delta reports spending pace against
		  the same span of days last month. Comparing "left" across two months
		  would compare two different allocations and mean nothing.
		-->
		<Delta
			current={data.spent}
			previous={data.prior.spent}
			lowerIsBetter
			label="spent vs {data.prior.label}"
		/>
	</p>
	<p class="hero-sub">
		of {formatMoney(allocated)} allocated · {daysLeft} days remaining
	</p>
{/if}

{#if !s.period}
	<p class="notice">
		No budget period covers this month — set one in <a href="/settings/budget">Budget settings</a>.
	</p>
{/if}

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Bucket</th>
				<th scope="col">Used</th>
				<th scope="col" class="num">Allocated</th>
				<th scope="col" class="num">Actual</th>
				<th scope="col" class="num">Remaining</th>
			</tr>
		</thead>
		<tbody>
			{#each s.rows as row (row.bucket)}
				{@const m = meter(row.actual, row.allocated)}
				<tr>
					<td data-label="Bucket">{row.label}</td>
					<td data-label="Used">
						<span class="meter-cell">
							<Meter value={m} />
							<span class="pct">{m ? `${m.pct}%` : ''}</span>
						</span>
					</td>
					<td data-label="Allocated" class="num amount">
						<Money value={row.allocated ?? 0} />
					</td>
					<td data-label="Actual" class="num amount"><Money value={row.actual} /></td>
					<td
						data-label="Remaining"
						class="num amount {row.remaining == null ? '' : row.remaining < 0 ? 'neg' : ''}"
					>
						<Money value={row.remaining ?? 0} />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<h2>Add</h2>
<EntryBar action="?/create" entry={data.entry} values={form?.values} />
{#if form?.error}<p class="error">{form.error}</p>{/if}

<h2>Recent</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Date</th>
				<th scope="col" class="num">Amount</th>
				<th scope="col">Type</th>
				<th scope="col">Category</th>
				<th scope="col">Note</th>
			</tr>
		</thead>
		<tbody>
			{#each data.recent as t (t.id)}
				<tr>
					<td data-label="Date" class="num">{t.date}</td>
					<td data-label="Amount" class="num amount">
						<Money value={t.amountPaise} direction={t.direction} />
					</td>
					<td data-label="Type">
						{#if t.direction === 'income'}
							<span class="tag">income</span>
						{:else}
							<span class="tag">{t.bucket}</span>
						{/if}
					</td>
					<td data-label={t.categoryName ? 'Category' : null}>{t.categoryName ?? ''}</td>
					<td data-label={t.note ? 'Note' : null} class="muted">{t.note ?? ''}</td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="5">Nothing recorded yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<h2>Goals</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Goal</th>
				<th scope="col">Progress</th>
				<th scope="col" class="num">Saved</th>
				<th scope="col" class="num">Target</th>
				<th scope="col" class="num">%</th>
			</tr>
		</thead>
		<tbody>
			{#each data.goals as g (g.goal.id)}
				{@const m = meter(g.contributed, g.goal.targetPaise)}
				<tr>
					<td data-label="Goal">
						{g.goal.name}
						{#if g.goal.kind === 'pot'}<span class="tag">pot</span>{/if}
					</td>
					<td data-label="Progress"><Meter value={m} /></td>
					<td data-label="Saved" class="num amount"><Money value={g.contributed} /></td>
					<td data-label="Target" class="num amount">
						<Money value={g.goal.targetPaise ?? 0} />
					</td>
					<td data-label="%" class="num">{m ? `${m.pct}%` : '—'}</td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="5">No goals yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<p class="hero-sub">Lendings outstanding {formatMoney(data.lendingsOutstanding)}</p>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/routes/pages.spec.ts`
Expected: PASS, including the pre-existing home test.

- [ ] **Step 7: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 8: Verify by eye**

Run `npm run dev`. Confirm: the hero shows a headline figure at `--t-hero`; a bucket over its allocation shows a split meter; adding a transaction from home keeps you on home with the amount field refocused; the ledger's entry bar still works unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/EntryBar.svelte src/routes/+page.server.ts src/routes/+page.svelte src/routes/ledger/+page.svelte src/routes/ledger/+page.server.ts src/routes/pages.spec.ts
git commit -m "feat(home): command centre with hero, bucket instrument and entry bar"
```

---

### Task 9: Ledger — adopt the money convention

**Files:**

- Modify: `src/routes/ledger/+page.svelte:153-202`

**Interfaces:**

- Consumes: `Money` (Task 6)

- [ ] **Step 1: Replace the amount cell**

In the transactions table, swap the hand-rolled sign logic:

```svelte
<td data-label="Amount" class="num amount">
	<Money value={t.amountPaise} direction={t.direction} />
</td>
```

The `pos` class and the `+` prefix now come from the component, so delete `{t.direction === 'income' ? 'pos' : ''}` and `{t.direction === 'income' ? '+' : ''}` from that cell, and drop the `formatMoney` import if the page-head total is the only other user — the total keeps `formatMoney`, so leave the import in place.

- [ ] **Step 2: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 3: Verify by eye**

Run `npm run dev`, open `/ledger`, and confirm income rows render `+₹…` in green while outflows render bare.

- [ ] **Step 4: Commit**

```bash
git add src/routes/ledger/+page.svelte
git commit -m "feat(ledger): adopt the shared money-cell convention"
```

---

### Task 10: Monthly — deltas, meter figures and arrow-key stepping

**Files:**

- Modify: `src/routes/monthly/+page.server.ts`
- Modify: `src/routes/monthly/+page.svelte`
- Modify: `src/routes/pages.spec.ts`

**Interfaces:**

- Consumes: `dayBoundIn` (Task 3), `monthlyActuals` with `through` (Task 4), `Money`/`Delta`/`Meter` (Task 6)
- Produces: `/monthly` load returns `{ summary, prior: { label, income, spent }, isCurrentMonth }`

**Keyboard deviation, documented deliberately:** DESIGN.md says the stepper responds to arrow keys "when the group has focus". Focus is lost across a navigation, so a group-scoped handler only ever fires once. This implements it at page level instead, guarded so it never fires while a form control has focus. That is strictly more useful for a keyboard-driven app and is the intent of the rule.

- [ ] **Step 1: Write the failing test**

Append to `src/routes/pages.spec.ts`:

```ts
describe('monthly comparison', () => {
	it('compares a completed month against the whole prior month', () => {
		createTransaction(db, {
			date: '2026-06-20',
			amountPaise: 700000,
			direction: 'outflow',
			bucket: 'wants'
		});
		createTransaction(db, {
			date: '2026-07-05',
			amountPaise: 300000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const data = monthly.load(event('/monthly?year=2026&month=7')) as any;
		expect(data.isCurrentMonth).toBe(false);
		expect(data.prior.spent).toBe(700000);
		expect(data.prior.label).toBe('June');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/routes/pages.spec.ts`
Expected: FAIL — `data.prior` is undefined.

- [ ] **Step 3: Rewrite the page server**

Replace `src/routes/monthly/+page.server.ts`:

```ts
import { dayBoundIn, MONTH_NAMES, prevMonth, todayISO } from '$lib/dates';
import { monthSummary } from '$lib/server/budgets';
import { monthlyActuals } from '$lib/server/ledger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const today = todayISO();
	const year = Number(url.searchParams.get('year')) || Number(today.slice(0, 4));
	const month = Number(url.searchParams.get('month')) || Number(today.slice(5, 7));

	const isCurrentMonth = year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7));
	const prev = prevMonth(year, month);

	// A month in progress compares against the same span of days; a completed
	// month compares whole against whole.
	const through = isCurrentMonth
		? dayBoundIn(prev.year, prev.month, Number(today.slice(8, 10)))
		: undefined;
	const priorActuals = monthlyActuals(locals.db, prev.year, prev.month, through);

	return {
		summary: monthSummary(locals.db, year, month),
		isCurrentMonth,
		prior: {
			label: MONTH_NAMES[prev.month - 1],
			income: priorActuals.income,
			spent: priorActuals.needs + priorActuals.wants + priorActuals.invest
		}
	};
};
```

- [ ] **Step 4: Update the page markup**

In `src/routes/monthly/+page.svelte`, add the imports and the key handler, wrap the KPI values in `Delta`, and swap the meter cells:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import Delta from '$lib/components/Delta.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Meter from '$lib/components/Meter.svelte';
	import Money from '$lib/components/Money.svelte';
	import { monthLabel, nextMonth, prevMonth } from '$lib/dates';
	import { formatBP, formatMoney } from '$lib/money';
	import { meter } from '$lib/progress';

	let { data } = $props();

	const s = $derived(data.summary);
	const prev = $derived(prevMonth(s.year, s.month));
	const next = $derived(nextMonth(s.year, s.month));
	const spent = $derived(s.rows.reduce((t, r) => t + r.actual, 0));
	const prevHref = $derived(`/monthly?year=${prev.year}&month=${prev.month}`);
	const nextHref = $derived(`/monthly?year=${next.year}&month=${next.month}`);

	// DESIGN.md asks for arrow-key stepping. Focus does not survive a
	// navigation, so a group-scoped handler would fire only once; this listens
	// at page level and stands down whenever a form control has focus.
	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
		const el = e.target as HTMLElement | null;
		if (el && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)))
			return;
		if (e.key === 'ArrowLeft') goto(prevHref);
		else if (e.key === 'ArrowRight') goto(nextHref);
	}
</script>

<svelte:window {onkeydown} />
```

Point the two stepper links at `prevHref` / `nextHref`. Replace the three KPI tiles with delta-carrying ones:

```svelte
<div class="kpis">
	<div class="kpi">
		<div class="label">Income</div>
		<div class="value pos">{formatMoney(s.income)}</div>
		<Delta current={s.income} previous={data.prior.income} label="vs {data.prior.label}" />
	</div>
	<div class="kpi">
		<div class="label">Spent</div>
		<div class="value">{formatMoney(spent)}</div>
		<Delta
			current={spent}
			previous={data.prior.spent}
			lowerIsBetter
			label="vs {data.prior.label}"
		/>
	</div>
	<div class="kpi">
		<div class="label">Left</div>
		<div class="value {s.income - spent < 0 ? 'neg' : ''}">{formatMoney(s.income - spent)}</div>
	</div>
</div>
```

In the bucket table, replace the `Used` cell with the meter-plus-figure pair and the three money cells with `<Money …>`, exactly as home does:

```svelte
<td data-label="Used">
	<span class="meter-cell">
		<Meter value={m} />
		<span class="pct">{m ? `${m.pct}%` : ''}</span>
	</span>
</td>
```

- [ ] **Step 5: Run tests and gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 6: Verify by eye**

Run `npm run dev`, open `/monthly`, press ← and → to step months, then click into the month `<select>` on `/ledger` and confirm arrow keys still change the select rather than navigating.

- [ ] **Step 7: Commit**

```bash
git add src/routes/monthly/+page.server.ts src/routes/monthly/+page.svelte src/routes/pages.spec.ts
git commit -m "feat(monthly): month-over-month deltas and arrow-key stepping"
```

---

### Task 11: Auth polish

**Files:**

- Modify: `src/routes/login/+page.svelte:14`, `src/routes/setup/+page.svelte:14`
- Modify: `src/app.css` (`.auth`)

- [ ] **Step 1: Apply the spec'd sizes**

DESIGN.md § auth-card: the mark is 56px, and auth is the one screen that gets `--space-7`. Change `<FreyrMark size={64} />` to `size={56}` in both files, and in `src/app.css`:

```css
.auth {
	display: grid;
	place-items: center;
	min-height: 100dvh;
	padding: var(--space-7) var(--space-4);
}
```

- [ ] **Step 2: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 3: Commit**

```bash
git add src/routes/login/+page.svelte src/routes/setup/+page.svelte src/app.css
git commit -m "feat(auth): spec'd mark size and breathing room"
```

---

### Task 12: Yearly — compact rollup with allocation

> **Blocked by the Prerequisite Gate.** Requires `monthlyActualsForYear` and `yearlyAllocation` from Task 6 of the promotion-weights plan. This task supersedes that plan's Task 8.

**Files:**

- Modify: `src/routes/yearly/+page.server.ts` (rewrite)
- Modify: `src/routes/yearly/+page.svelte` (rewrite)
- Modify: `src/routes/pages.spec.ts`

**Interfaces:**

- Consumes: `monthlyActualsForYear(db, year): MonthActuals[]` and `yearlyAllocation(periods, months, year): YearlyAllocation` (promotion plan Task 6); `listPeriods` (promotion plan Task 4); `yearlySummary` with `through` (Task 4 here); `Money`/`Delta` (Task 6 here)
- Produces: `/yearly` load returns `{ year, years, summary, months, allocation, prior: { year, income, spent } }`

- [ ] **Step 1: Write the failing test**

Append to `src/routes/pages.spec.ts`:

```ts
describe('yearly rollup', () => {
	it('returns per-bucket allocation alongside the month rows', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: '2026-03-01',
			amountPaise: 10000000,
			direction: 'income',
			incomeSource: 'job'
		});
		createTransaction(db, {
			date: '2026-03-05',
			amountPaise: 4000000,
			direction: 'outflow',
			bucket: 'needs'
		});

		const data = yearly.load(event('/yearly?year=2026')) as any;
		expect(data.allocation.rows).toHaveLength(3);
		const needs = data.allocation.rows.find((r: any) => r.bucket === 'needs');
		expect(needs.allocated).toBe(5000000);
		expect(needs.actual).toBe(4000000);
		expect(needs.variance).toBe(1000000);
	});

	it('compares a completed year whole against whole', () => {
		createTransaction(db, {
			date: '2025-05-01',
			amountPaise: 200000,
			direction: 'outflow',
			bucket: 'wants'
		});
		createTransaction(db, {
			date: '2026-05-01',
			amountPaise: 500000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const data = yearly.load(event('/yearly?year=2026')) as any;
		expect(data.prior.year).toBe(2025);
		expect(data.prior.spent).toBe(200000);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/routes/pages.spec.ts`
Expected: FAIL — `data.allocation` is undefined.

- [ ] **Step 3: Rewrite the page server**

```ts
import { dayBoundIn, todayISO } from '$lib/dates';
import { listPeriods, yearlyAllocation } from '$lib/server/budgets';
import { monthlyActualsForYear, years, yearlySummary } from '$lib/server/ledger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const today = todayISO();
	const allYears = years(locals.db);
	const fallback = allYears.at(-1) ?? Number(today.slice(0, 4));
	const year = Number(url.searchParams.get('year')) || fallback;

	// One query for every month, replacing the twelve-round-trip loop.
	const months = monthlyActualsForYear(locals.db, year);
	const allocation = yearlyAllocation(listPeriods(locals.db), months, year);

	// Like-for-like: a year in progress compares against the same span of days.
	const isCurrentYear = year === Number(today.slice(0, 4));
	const through = isCurrentYear
		? dayBoundIn(year - 1, Number(today.slice(5, 7)), Number(today.slice(8, 10)))
		: undefined;
	const priorSummary = yearlySummary(locals.db, year - 1, through);

	return {
		year,
		years: allYears,
		summary: yearlySummary(locals.db, year),
		months,
		allocation,
		prior: {
			year: year - 1,
			income: priorSummary.job + priorSummary.sideHustle,
			spent: priorSummary.needs + priorSummary.wants + priorSummary.invest
		}
	};
};
```

- [ ] **Step 4: Rewrite the page markup**

Three KPI tiles, then two tables. The eight tiles across three strips are gone — job and side hustle become columns.

```svelte
<script lang="ts">
	import Delta from '$lib/components/Delta.svelte';
	import Money from '$lib/components/Money.svelte';
	import { MONTH_NAMES } from '$lib/dates';
	import { formatBP, formatMoney } from '$lib/money';

	let { data } = $props();

	const income = $derived(data.summary.job + data.summary.sideHustle);
	const spent = $derived(data.summary.needs + data.summary.wants + data.summary.invest);
</script>

<svelte:head>
	<title>Yearly — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>{data.year}</h1>
	<form method="GET">
		<label class="visually-hidden" for="f-year">Year</label>
		<select id="f-year" name="year" onchange={(e) => e.currentTarget.form?.submit()}>
			{#each data.years as y (y)}
				<option value={y} selected={data.year === y}>{y}</option>
			{/each}
		</select>
		<noscript><button type="submit">Show</button></noscript>
	</form>
</div>

<div class="kpis">
	<div class="kpi">
		<div class="label">Income</div>
		<div class="value pos">{formatMoney(income)}</div>
		<Delta current={income} previous={data.prior.income} label="vs {data.prior.year}" />
	</div>
	<div class="kpi">
		<div class="label">Spent</div>
		<div class="value">{formatMoney(spent)}</div>
		<Delta current={spent} previous={data.prior.spent} lowerIsBetter label="vs {data.prior.year}" />
	</div>
	<div class="kpi">
		<div class="label">Net</div>
		<div class="value {income - spent < 0 ? 'neg' : ''}">{formatMoney(income - spent)}</div>
	</div>
</div>

<h2>Allocation vs actual</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Bucket</th>
				<th scope="col" class="num">Allocated</th>
				<th scope="col" class="num">Actual</th>
				<th scope="col" class="num">Variance</th>
				<th scope="col" class="num">Effective rate</th>
			</tr>
		</thead>
		<tbody>
			{#each data.allocation.rows as row (row.bucket)}
				<tr>
					<td data-label="Bucket">{row.label}</td>
					<td data-label="Allocated" class="num amount"><Money value={row.allocated} /></td>
					<td data-label="Actual" class="num amount"><Money value={row.actual} /></td>
					<td data-label="Variance" class="num amount {row.variance < 0 ? 'neg' : ''}">
						<Money value={row.variance} />
					</td>
					<td data-label="Effective rate" class="num muted">
						{row.effectiveBP == null ? '—' : formatBP(row.effectiveBP)}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<p class="hero-sub">
	Unallocated income {formatMoney(data.allocation.unallocated)} — income minus the three buckets.
</p>

<h2>By month</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Month</th>
				<th scope="col" class="num">Income</th>
				<th scope="col" class="num">Needs</th>
				<th scope="col" class="num">Wants</th>
				<th scope="col" class="num">Investments</th>
			</tr>
		</thead>
		<tbody>
			{#each data.months as m (m.month)}
				<tr>
					<td data-label="Month">
						<a href="/monthly?year={data.year}&month={m.month}">{MONTH_NAMES[m.month - 1]}</a>
					</td>
					<td data-label="Income" class="num amount">
						<Money value={m.income} direction="income" />
					</td>
					<td data-label="Needs" class="num amount"><Money value={m.needs} /></td>
					<td data-label="Wants" class="num amount"><Money value={m.wants} /></td>
					<td data-label="Investments" class="num amount"><Money value={m.invest} /></td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="5">No transactions in {data.year}.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<h2>Income split</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Source</th>
				<th scope="col" class="num">Amount</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td data-label="Source">Job</td>
				<td data-label="Amount" class="num amount"><Money value={data.summary.job} /></td>
			</tr>
			<tr>
				<td data-label="Source">Side hustle</td>
				<td data-label="Amount" class="num amount"><Money value={data.summary.sideHustle} /></td>
			</tr>
		</tbody>
	</table>
</div>
```

- [ ] **Step 5: Run tests and gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/routes/yearly/+page.server.ts src/routes/yearly/+page.svelte src/routes/pages.spec.ts
git commit -m "feat(yearly): compact rollup with allocation, variance and effective rate"
```

---

### Task 13: Budget settings — policy, promotions and periods

> **Blocked by the Prerequisite Gate.** Requires the promotions domain from Task 5 of the promotion-weights plan. This task supersedes that plan's Task 7.

**Files:**

- Modify: `src/routes/settings/budget/+page.server.ts` (rewrite)
- Modify: `src/routes/settings/budget/+page.svelte` (rewrite)
- Modify: `src/routes/pages.spec.ts`

**Interfaces:**

- Consumes: `getPolicy`, `updatePolicy`, `listPromotions`, `createPromotion`, `deletePromotion`, `rebuildProjectedPeriods` (promotion plan Task 5); `listPeriods`, `activeFor`, `createPeriod` (promotion plan Task 4); `weightsAfter` (promotion plan Task 2)
- Produces: named form actions `savePolicy`, `addPromotion`, `deletePromotion`, `addPeriod` on `/settings/budget`

Three sections, in this order: **Policy** (base and marginal triples, with the long-run destination shown so the asymptote is visible rather than implied), **Promotions** (log form plus a table where each row shows the resulting W/N/I), **Periods** (the existing manual editor, with `base`/`promotion`/`manual` source badges).

Follow the promotion-weights plan's Task 7 for the server actions and validation, with these redesign changes layered on:

- Money and percentage figures render through `<Money>` and `formatBP`, never raw `formatMoney`.
- The periods table's `source` renders as a `bucket-tag`-style `<span class="tag">`, monochrome — buckets and sources are categories, not directions.
- The add-period form keeps `class="entry"` inside `<details class="entry-wrap" open>`, matching the entry bar.
- Each promotion row carries a `button-danger-icon` delete (`<button class="icon">` with `aria-label`), matching the ledger's row delete.

- [ ] **Step 1: Follow promotion-weights plan Task 7, Steps 1–3**

Those steps contain the full failing test, the failure verification, and the page-server rewrite. Do not restate them here — read them from `docs/superpowers/plans/2026-08-03-promotion-driven-weights.md` and execute them as written.

- [ ] **Step 2: Write the page markup**

Follow promotion-weights plan Task 7, Step 4, applying the four redesign changes listed above.

- [ ] **Step 3: Run tests and gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 4: Verify by eye**

Run `npm run dev`, open `/settings/budget`, add a promotion, and confirm the periods table gains a `promotion`-tagged row with the recomputed weights.

- [ ] **Step 5: Commit**

```bash
git add src/routes/settings/budget/+page.server.ts src/routes/settings/budget/+page.svelte src/routes/pages.spec.ts
git commit -m "feat(budget): policy, promotions and source-tagged periods"
```

---

### Task 14: Documentation

**Files:**

- Modify: `README.md`, `ARCHITECTURE.md`, `DESIGN.md`
- Modify: `docs/superpowers/specs/2026-08-04-ui-redesign-design.md`
- Modify: `docs/superpowers/plans/2026-08-03-promotion-driven-weights.md`

- [ ] **Step 1: Confirm the spec's query accounting still holds**

The spec's § Performance section was corrected while this plan was written: home issues **nine** bounded queries, not five. Re-read it against the implemented `src/routes/+page.server.ts` and correct it again if the load function ended up differing. A spec that undercounts is a spec an implementer will trust and be wrong.

- [ ] **Step 2: Mark the superseded tasks**

In `docs/superpowers/plans/2026-08-03-promotion-driven-weights.md`, add a line under the Task 7 and Task 8 headings: `> Superseded by Task 13 / Task 12 of docs/superpowers/plans/2026-08-04-ui-redesign.md.`

- [ ] **Step 3: Update `DESIGN.md` § Known Gaps**

Remove the entries that are no longer gaps and keep the ones that are:

- Delete nothing about charts or dialogs — both remain unbuilt and out of scope.
- The `progress-meter` overflow, the `money-cell` zero rule, `delta-cell`, `--t-hero` and `--space-7` are now implemented; if any Known Gap or § Components line describes them as pending, correct it.
- Add a gap entry recording the topbar trade-off: the mobile top bar carries the nav label as a `<span>` while the page keeps its own `<h1>`, so a page whose heading matches its nav label shows the name twice.
- Add a gap entry recording that arrow-key month stepping is page-level and suppressed inside form controls, rather than group-scoped.

- [ ] **Step 4: Update `README.md` and `ARCHITECTURE.md`**

`README.md`: describe home as the command centre — hero figure, bucket meters, inline add, recent activity — rather than a summary page.

`ARCHITECTURE.md`: add `src/lib/format.ts` and `src/lib/server/txn-form.ts` to the module map, note the three shared presentation components, and record that presentation _rules_ live in pure functions because the test setup has no component environment.

- [ ] **Step 5: Run the gates**

Run: `npm run check && npm run lint && npm test`
Expected: all clean. `npm run lint` includes `prettier --check` over markdown, so run `npm run format` if it complains.

- [ ] **Step 6: Commit**

```bash
git add README.md ARCHITECTURE.md DESIGN.md docs/
git commit -m "docs: reflect the redesigned UI and correct the spec's query count"
```

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: `format.ts` → Task 1; meter overflow → Task 2; `through`/`limit` → Tasks 3–4; the three components → Task 6; shell → Task 7; home including the awaiting-income state → Task 8; ledger → Task 9; monthly → Task 10; auth → Task 11; yearly → Task 12; budget settings → Task 13; docs → Task 14. The spec's "not adding `--c1`…`--c5`" decision is honoured by their absence and restated in Global Constraints.

**One addition beyond the spec.** Task 5 (`txn-form.ts`) is not named in the spec. It exists because Task 8 gives home a `create` action identical to the ledger's, and shipping that duplication would contradict the spec's own reason for creating `format.ts`. It is a refactor with no behaviour change, gated by the existing ledger action tests.

**One correction against the spec.** The spec's home query count of five is wrong; the real figure is nine. Task 14 Step 1 fixes the spec rather than leaving the discrepancy.

**Type consistency.** `Flow` is used identically in `format.ts`, `Money.svelte` and every call site. `Meter` gains `overflow` in Task 2 and is consumed as such in `Meter.svelte` (Task 6) and by home and monthly. `dayBoundIn(year, month, dayOfMonth)` keeps that argument order in Tasks 8, 10 and 12. `createFromForm(db, values)` is called identically from both actions. The `entry` prop shape is defined once in Task 8 and used by home and ledger.

**Known ordering hazard.** Task 8 modifies `src/routes/ledger/+page.server.ts` (to group the `entry` keys) and Task 9 modifies `src/routes/ledger/+page.svelte`. Run them in order; do not parallelise those two.
