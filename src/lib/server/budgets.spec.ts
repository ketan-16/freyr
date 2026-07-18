import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fromRupees } from '$lib/money';
import { activeFor, allocate, createPeriod, listPeriods } from './budgets';
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
