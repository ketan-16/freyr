import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fromRupees } from '$lib/money';
import { activeFor, allocate, createPeriod, listPeriods, periodFor } from './budgets';
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
