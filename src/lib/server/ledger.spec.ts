import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fromRupees, type Paise } from '$lib/money';
import { createCategory } from './categories';
import { createGoal, ensureLocation } from './goals';
import {
	createTransaction,
	deleteTransaction,
	listTransactions,
	monthlyActuals,
	monthlyActualsForYear,
	monthsWithData,
	years,
	yearlySummary,
	type Bucket,
	type Source
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
		const categoryId = createCategory(db, { scope: 'needs', name: 'Grocery' });
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
	it('filters by month and bucket, newest first, with the category name', () => {
		const goalId = createGoal(db, { name: 'Car', kind: 'goal' });
		const locationId = ensureLocation(db, 'Bank');
		const categoryId = createCategory(db, { scope: 'needs', name: 'Grocery' });
		createTransaction(db, {
			date: '2026-06-15',
			amountPaise: 100,
			direction: 'outflow',
			bucket: 'needs',
			categoryId
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
		// Goal and location stay as ids on the row: no screen prints their names,
		// so listTransactions no longer joins for them.
		expect(july[0].goalId).toBe(goalId);
		expect(july[0].locationId).toBe(locationId);

		const [june] = listTransactions(db, { year: 2026, month: 6 });
		expect(june.categoryName).toBe('Grocery');

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

describe('monthlyActualsForYear', () => {
	const addIncome = (date: string, amountPaise: Paise, incomeSource: Source = 'job') =>
		createTransaction(db, { date, amountPaise, direction: 'income', incomeSource });
	const addOutflow = (date: string, amountPaise: Paise, bucket: Bucket) =>
		createTransaction(db, { date, amountPaise, direction: 'outflow', bucket });

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

	it('agrees with monthlyActuals for all twelve months, present or absent', () => {
		// Exercises every column the grouped query computes: all three buckets, both
		// counted income sources, the excluded one, a month with outflows but no
		// income, and the two months that bracket the year.
		addIncome('2025-01-10', fromRupees(100000), 'job');
		addIncome('2025-01-11', fromRupees(15000), 'side_hustle');
		addIncome('2025-01-12', fromRupees(40000), 'other'); // a repayment, never budget income
		addOutflow('2025-01-15', fromRupees(30000), 'needs');
		addOutflow('2025-01-16', fromRupees(9000), 'wants');
		addOutflow('2025-01-17', fromRupees(25000), 'investments');
		addOutflow('2025-07-04', fromRupees(1234), 'wants'); // spend with no income
		addIncome('2025-12-31', fromRupees(70000), 'side_hustle');
		addIncome('2024-12-31', fromRupees(999), 'job'); // adjacent years must not leak
		addIncome('2026-01-01', fromRupees(999), 'job');

		const rows = monthlyActualsForYear(db, 2025);
		expect(rows.map((r) => r.month)).toEqual([1, 7, 12]);
		for (let month = 1; month <= 12; month++) {
			const one = monthlyActuals(db, 2025, month);
			const row = rows.find((r) => r.month === month);
			if (row) expect({ ...row, month: undefined }).toEqual({ ...one, month: undefined });
			else expect(one).toEqual({ income: 0, needs: 0, wants: 0, invest: 0 });
		}
	});
});
