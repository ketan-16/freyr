import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTransaction } from './ledger';
import { testDb } from './test-db';
import { priorMonth, priorYear } from './comparison';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

describe('priorMonth', () => {
	it('compares a completed target month against the whole prior month', () => {
		// Target is July, viewed from August — July is over, so June (the prior
		// month) must count in full, not just its first few days.
		createTransaction(db, {
			date: '2026-06-01',
			amountPaise: 5000000,
			direction: 'income',
			incomeSource: 'job'
		});
		createTransaction(db, {
			date: '2026-06-01',
			amountPaise: 200000,
			direction: 'outflow',
			bucket: 'needs'
		});
		createTransaction(db, {
			date: '2026-06-30',
			amountPaise: 150000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const result = priorMonth(db, 2026, 7, '2026-08-15');
		expect(result.label).toBe('June');
		expect(result.income).toBe(5000000);
		expect(result.spent).toBe(350000);
	});

	it('bounds the prior month to the same span of days when the target month is in progress', () => {
		// Viewing July on the 10th: June must be cut off at the 10th too, so a
		// txn on June 11 must not count.
		createTransaction(db, {
			date: '2026-06-10',
			amountPaise: 500000,
			direction: 'outflow',
			bucket: 'needs'
		});
		createTransaction(db, {
			date: '2026-06-11',
			amountPaise: 900000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const result = priorMonth(db, 2026, 7, '2026-07-10');
		expect(result.spent).toBe(500000);
	});

	it("January's prior month is December of the previous year", () => {
		createTransaction(db, {
			date: '2025-12-05',
			amountPaise: 200000,
			direction: 'outflow',
			bucket: 'needs'
		});

		const result = priorMonth(db, 2026, 1, '2026-02-01');
		expect(result.label).toBe('December');
		expect(result.spent).toBe(200000);
	});

	it('clamps the day bound: viewing 31 March compares against the whole of February', () => {
		createTransaction(db, {
			date: '2026-02-01',
			amountPaise: 100000,
			direction: 'outflow',
			bucket: 'needs'
		});
		createTransaction(db, {
			date: '2026-02-28',
			amountPaise: 200000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const result = priorMonth(db, 2026, 3, '2026-03-31');
		expect(result.label).toBe('February');
		expect(result.spent).toBe(300000);
	});

	it('returns zero income and spend for an empty prior period, not NaN', () => {
		const result = priorMonth(db, 2026, 7, '2026-08-01');
		expect(result.income).toBe(0);
		expect(result.spent).toBe(0);
		expect(Number.isNaN(result.income)).toBe(false);
		expect(Number.isNaN(result.spent)).toBe(false);
	});
});

describe('priorYear', () => {
	it('compares a completed target year against the whole prior year', () => {
		// Target is 2026, viewed from 2027 — 2026 is over, so 2025 (the prior
		// year) must count in full.
		createTransaction(db, {
			date: '2025-03-01',
			amountPaise: 10000000,
			direction: 'income',
			incomeSource: 'job'
		});
		createTransaction(db, {
			date: '2025-04-01',
			amountPaise: 2000000,
			direction: 'income',
			incomeSource: 'side_hustle'
		});
		createTransaction(db, {
			date: '2025-12-20',
			amountPaise: 500000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const result = priorYear(db, 2026, '2027-01-15');
		expect(result.label).toBe('2025');
		expect(result.income).toBe(12000000);
		expect(result.spent).toBe(500000);
	});

	it('bounds the prior year to the same span of days when the target year is in progress', () => {
		// Viewing 2026 on 10 August: 2025 must be cut off at 10 August too, so a
		// txn on 11 August 2025 must not count.
		createTransaction(db, {
			date: '2025-08-10',
			amountPaise: 400000,
			direction: 'outflow',
			bucket: 'needs'
		});
		createTransaction(db, {
			date: '2025-08-11',
			amountPaise: 900000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const result = priorYear(db, 2026, '2026-08-10');
		expect(result.spent).toBe(400000);
	});

	it('clamps the day bound: a leap day compares against the whole of February in a non-leap prior year', () => {
		// 2024 is a leap year (29 Feb exists); 2023 is not (Feb has 28 days).
		// Viewing 2024 on 29 Feb must still pull in all of Feb 2023, not stop
		// short at a day that year never had.
		createTransaction(db, {
			date: '2023-01-15',
			amountPaise: 100000,
			direction: 'outflow',
			bucket: 'needs'
		});
		createTransaction(db, {
			date: '2023-02-28',
			amountPaise: 50000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const result = priorYear(db, 2024, '2024-02-29');
		expect(result.label).toBe('2023');
		expect(result.spent).toBe(150000);
	});

	it('returns zero income and spend for an empty prior period, not NaN', () => {
		const result = priorYear(db, 2026, '2026-05-01');
		expect(result.income).toBe(0);
		expect(result.spent).toBe(0);
		expect(Number.isNaN(result.income)).toBe(false);
		expect(Number.isNaN(result.spent)).toBe(false);
	});
});
