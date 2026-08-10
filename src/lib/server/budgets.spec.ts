import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fromRupees, mulBP } from '$lib/money';
import {
	activeFor,
	allocate,
	createPeriod,
	listPeriods,
	periodFor,
	yearlyAllocation
} from './budgets';
import { testDb } from './test-db';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

const P = { effectiveFrom: '2025-01-01', needsBP: 2720, wantsBP: 3000, investBP: 4280 };

describe('createPeriod', () => {
	it('creates a valid period', () => {
		expect(createPeriod(db, P)).toBeGreaterThan(0);
	});

	it('rejects basis points not summing to 10000', () => {
		expect(() => createPeriod(db, { ...P, investBP: 4000 })).toThrow(/100/);
	});

	it('rejects a duplicate effective date', () => {
		createPeriod(db, P);
		expect(() => createPeriod(db, P)).toThrow();
	});
});

describe('activeFor / listPeriods', () => {
	it('picks the latest period at or before the date', () => {
		const oldId = createPeriod(db, {
			effectiveFrom: '2024-08-01',
			needsBP: 3086,
			wantsBP: 3000,
			investBP: 3914
		});
		const newId = createPeriod(db, P);

		expect(activeFor(db, '2024-12-31')?.id).toBe(oldId);
		expect(activeFor(db, '2025-06-01')?.id).toBe(newId);
		expect(activeFor(db, '2020-01-01')).toBeNull();
		expect(listPeriods(db).map((p) => p.id)).toEqual([newId, oldId]);
	});
});

describe('allocate', () => {
	it('splits income by basis points', () => {
		const period = { id: 1, ...P };
		expect(allocate(fromRupees(100000), period)).toEqual({
			needs: fromRupees(27200),
			wants: fromRupees(30000),
			invest: fromRupees(42800)
		});
	});
});

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

	const promoId = (effectiveDate: string) =>
		Number(
			db
				.prepare('INSERT INTO promotions (effective_date, increment_bp) VALUES (?, ?)')
				.run(effectiveDate, 2000).lastInsertRowid
		);

	it('prefers a manual row over a generated one on the same date', () => {
		insert('2025-01-01', 2720, 'base');
		insert('2025-01-01', 3500, 'manual');
		expect(activeFor(db, '2025-06-01')?.needsBP).toBe(3500);
	});

	it('prefers a promotion row over a base row on the same date', () => {
		insert('2025-01-01', 5000, 'base');
		insert('2025-01-01', 2720, 'promotion', promoId('2025-01-01'));
		expect(activeFor(db, '2025-06-01')?.needsBP).toBe(2720);
	});

	it('still prefers a later date over a higher-precedence earlier one', () => {
		insert('2025-01-01', 3500, 'manual');
		insert('2025-06-01', 2720, 'promotion', promoId('2025-06-01'));
		expect(activeFor(db, '2025-09-01')?.needsBP).toBe(2720);
	});

	it('reports the source it picked', () => {
		insert('2025-01-01', 5000, 'base');
		expect(activeFor(db, '2025-06-01')?.source).toBe('base');
	});

	it('periodFor matches activeFor without touching the database', () => {
		insert('2024-01-01', 5000, 'base');
		insert('2025-01-01', 3500, 'manual');
		insert('2025-01-01', 2720, 'promotion', promoId('2025-01-01'));
		const periods = listPeriods(db);
		for (const date of ['2023-01-01', '2024-06-01', '2025-06-01']) {
			expect(periodFor(periods, date)?.needsBP ?? null).toBe(activeFor(db, date)?.needsBP ?? null);
		}
	});
});

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

	it('reports no effective rate at all when the year had no income', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		const y = yearlyAllocation(
			listPeriods(db),
			[{ month: 3, income: 0, needs: fromRupees(4000), wants: 0, invest: 0 }],
			2025
		);
		// null, not NaN and not a 0 that would read as "took no share".
		expect(y.rows.map((r) => r.effectiveBP)).toEqual([null, null, null]);
	});

	it('reports a negative unallocated when spending outran income', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		const y = yearlyAllocation(
			listPeriods(db),
			[{ month: 5, income: fromRupees(10000), needs: fromRupees(18000), wants: 0, invest: 0 }],
			2025
		);
		expect(y.unallocated).toBe(-fromRupees(8000));
	});

	it('rounds each month on its own rather than the year as a whole', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		const halfPaise = [
			{ month: 1, income: 1, needs: 0, wants: 0, invest: 0 },
			{ month: 2, income: 1, needs: 0, wants: 0, invest: 0 }
		];
		const needs = yearlyAllocation(listPeriods(db), halfPaise, 2025).rows.find(
			(r) => r.bucket === 'needs'
		)!;
		// Each month's half-paise rounds up on its own; folding first would give 1.
		expect(needs.allocated).toBe(2);
		expect(mulBP(1 + 1, 5000)).toBe(1);
	});

	it('names every bucket exactly once, in ledger order', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		const y = yearlyAllocation(listPeriods(db), months, 2025);
		expect(y.rows.map((r) => r.bucket)).toEqual(['needs', 'wants', 'investments']);
		expect(y.rows.map((r) => r.label)).toEqual(['Needs', 'Wants', 'Investments']);
	});
});
