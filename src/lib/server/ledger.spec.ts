import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGoal, ensureLocation } from './goals';
import {
	createTransaction,
	deleteTransaction,
	ensureCategory,
	listCategories,
	listTransactions,
	monthlyActuals,
	monthsWithData,
	years,
	yearlySummary
} from './ledger';
import { testDb } from './test-db';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

describe('createTransaction', () => {
	it('creates income with a source and no bucket', () => {
		const id = createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 14020900,
			direction: 'income',
			incomeSource: 'job'
		});
		expect(id).toBeGreaterThan(0);
	});

	it('creates a bucketed outflow with a category', () => {
		const categoryId = ensureCategory(db, 'Grocery');
		const id = createTransaction(db, {
			date: '2026-07-02',
			amountPaise: 50000,
			direction: 'outflow',
			bucket: 'needs',
			categoryId,
			note: 'groceries'
		});
		expect(id).toBeGreaterThan(0);
	});

	it.each([
		[
			'income with bucket',
			{
				date: '2026-07-01',
				amountPaise: 100,
				direction: 'income',
				incomeSource: 'job',
				bucket: 'needs'
			}
		],
		['income without source', { date: '2026-07-01', amountPaise: 100, direction: 'income' }],
		['outflow without bucket', { date: '2026-07-01', amountPaise: 100, direction: 'outflow' }],
		[
			'outflow with source',
			{
				date: '2026-07-01',
				amountPaise: 100,
				direction: 'outflow',
				bucket: 'wants',
				incomeSource: 'job'
			}
		],
		['zero amount', { date: '2026-07-01', amountPaise: 0, direction: 'outflow', bucket: 'wants' }],
		[
			'fractional amount',
			{ date: '2026-07-01', amountPaise: 10.5, direction: 'outflow', bucket: 'wants' }
		],
		['bad date', { date: '01/07/2026', amountPaise: 100, direction: 'outflow', bucket: 'wants' }]
	])('rejects %s', (_label, input) => {
		expect(() => createTransaction(db, input as never)).toThrow();
	});

	it('requires goal and location together', () => {
		const goalId = createGoal(db, { name: 'Car', kind: 'goal', targetPaise: 70000000 });
		const locationId = ensureLocation(db, 'Bank');

		expect(() =>
			createTransaction(db, {
				date: '2026-07-03',
				amountPaise: 1000000,
				direction: 'outflow',
				bucket: 'investments',
				goalId
			})
		).toThrow(/location/i);

		const id = createTransaction(db, {
			date: '2026-07-03',
			amountPaise: 1000000,
			direction: 'outflow',
			bucket: 'investments',
			goalId,
			locationId
		});
		expect(id).toBeGreaterThan(0);
	});
});

describe('listTransactions', () => {
	it('filters by month and bucket, newest first, with joined names', () => {
		const goalId = createGoal(db, { name: 'Car', kind: 'goal' });
		const locationId = ensureLocation(db, 'Bank');
		createTransaction(db, {
			date: '2026-06-15',
			amountPaise: 100,
			direction: 'outflow',
			bucket: 'needs'
		});
		createTransaction(db, {
			date: '2026-07-10',
			amountPaise: 200,
			direction: 'outflow',
			bucket: 'wants'
		});
		createTransaction(db, {
			date: '2026-07-20',
			amountPaise: 300,
			direction: 'outflow',
			bucket: 'investments',
			goalId,
			locationId
		});

		const july = listTransactions(db, { year: 2026, month: 7 });
		expect(july.map((t) => t.amountPaise)).toEqual([300, 200]);
		expect(july[0].goalName).toBe('Car');
		expect(july[0].locationName).toBe('Bank');

		const wants = listTransactions(db, { year: 2026, month: 7, bucket: 'wants' });
		expect(wants).toHaveLength(1);
		expect(wants[0].amountPaise).toBe(200);
	});
});

describe('deleteTransaction', () => {
	it('removes the row', () => {
		const id = createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 100,
			direction: 'outflow',
			bucket: 'needs'
		});
		deleteTransaction(db, id);
		expect(listTransactions(db, {})).toHaveLength(0);
	});
});

describe('categories', () => {
	it('ensureCategory is idempotent and listCategories sorts', () => {
		const a = ensureCategory(db, 'Grocery');
		const b = ensureCategory(db, 'Grocery');
		ensureCategory(db, 'Fuel');
		expect(a).toBe(b);
		expect(listCategories(db).map((c) => c.name)).toEqual(['Fuel', 'Grocery']);
	});
});

describe('rollups', () => {
	beforeEach(() => {
		const seed = (input: Parameters<typeof createTransaction>[1]) => createTransaction(db, input);
		seed({ date: '2026-07-01', amountPaise: 14020900, direction: 'income', incomeSource: 'job' });
		seed({
			date: '2026-07-05',
			amountPaise: 500000,
			direction: 'income',
			incomeSource: 'side_hustle'
		});
		// repayment received — excluded from budget income
		seed({ date: '2026-07-06', amountPaise: 1000000, direction: 'income', incomeSource: 'other' });
		seed({ date: '2026-07-07', amountPaise: 3000000, direction: 'outflow', bucket: 'needs' });
		seed({ date: '2026-07-08', amountPaise: 61300, direction: 'outflow', bucket: 'needs' });
		seed({ date: '2026-07-09', amountPaise: 6000000, direction: 'outflow', bucket: 'investments' });
		// different month — must not leak in
		seed({ date: '2026-06-30', amountPaise: 99900, direction: 'outflow', bucket: 'needs' });
	});

	it('monthlyActuals sums the month per bucket, income excludes repayments', () => {
		const m = monthlyActuals(db, 2026, 7);
		expect(m).toEqual({
			income: 14520900,
			needs: 3061300,
			wants: 0,
			invest: 6000000
		});
	});

	it('yearlySummary splits income by source', () => {
		const y = yearlySummary(db, 2026);
		expect(y).toEqual({
			job: 14020900,
			sideHustle: 500000,
			needs: 3161200,
			wants: 0,
			invest: 6000000
		});
	});

	it('years and monthsWithData', () => {
		expect(years(db)).toEqual([2026]);
		expect(monthsWithData(db, 2026)).toEqual([6, 7]);
	});

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
});
