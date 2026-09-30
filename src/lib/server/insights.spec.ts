import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCategory } from './categories';
import { dailyTotals, monthlyTotals, monthRange, outflowByCategory, yearRange } from './insights';
import { createTransaction, monthlyActuals, type Bucket } from './ledger';
import { testDb } from './test-db';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

function out(date: string, amountPaise: number, bucket: Bucket, categoryId?: number) {
	createTransaction(db, { date, amountPaise, direction: 'outflow', bucket, categoryId });
}

describe('ranges', () => {
	it('are half-open and roll over the year', () => {
		expect(monthRange(2026, 9)).toEqual(['2026-09-01', '2026-10-01']);
		expect(monthRange(2026, 12)).toEqual(['2026-12-01', '2027-01-01']);
		expect(yearRange(2026)).toEqual(['2026-01-01', '2027-01-01']);
	});
});

describe('dailyTotals', () => {
	it('sums each day by bucket, leaving quiet days out', () => {
		out('2026-09-02', 1000, 'needs');
		out('2026-09-02', 500, 'wants');
		out('2026-09-05', 250, 'investments');
		out('2026-10-01', 9999, 'needs'); // next month: excluded
		createTransaction(db, {
			date: '2026-09-01',
			amountPaise: 100000,
			direction: 'income',
			incomeSource: 'job'
		});

		expect(dailyTotals(db, 2026, 9)).toEqual([
			{ day: 1, income: 100000, needs: 0, wants: 0, invest: 0 },
			{ day: 2, income: 0, needs: 1000, wants: 500, invest: 0 },
			{ day: 5, income: 0, needs: 0, wants: 0, invest: 250 }
		]);
	});

	// The same rule monthlyActuals applies, so a chart and its table agree.
	it('counts only the income the rollups count', () => {
		createTransaction(db, {
			date: '2026-09-03',
			amountPaise: 5000,
			direction: 'income',
			incomeSource: 'other'
		});
		expect(dailyTotals(db, 2026, 9)).toEqual([
			{ day: 3, income: 0, needs: 0, wants: 0, invest: 0 }
		]);
		expect(monthlyActuals(db, 2026, 9).income).toBe(0);
	});
});

describe('monthlyTotals', () => {
	it('groups a range that crosses New Year month by month', () => {
		out('2025-12-31', 700, 'wants');
		out('2026-01-01', 300, 'needs');
		out('2026-01-20', 200, 'needs');
		out('2026-03-01', 100, 'needs'); // outside the range

		expect(monthlyTotals(db, '2025-12-01', '2026-02-01')).toEqual([
			{ year: 2025, month: 12, income: 0, needs: 0, wants: 700, invest: 0 },
			{ year: 2026, month: 1, income: 0, needs: 500, wants: 0, invest: 0 }
		]);
	});
});

describe('outflowByCategory', () => {
	it('ranks categories by spend and keeps uncategorised rows per bucket', () => {
		const food = createCategory(db, { scope: 'wants', name: 'Food' });
		const rent = createCategory(db, { scope: 'needs', name: 'Rent' });
		out('2026-09-01', 30000, 'needs', rent);
		out('2026-09-02', 400, 'wants', food);
		out('2026-09-03', 600, 'wants', food);
		out('2026-09-04', 900, 'wants');
		out('2026-09-05', 50, 'needs');
		createTransaction(db, {
			date: '2026-09-01',
			amountPaise: 100000,
			direction: 'income',
			incomeSource: 'job'
		});

		const rows = outflowByCategory(db, ...monthRange(2026, 9));
		expect(rows.map((r) => [r.name, r.bucket, r.total, r.count])).toEqual([
			['Rent', 'needs', 30000, 1],
			['Food', 'wants', 1000, 2],
			[null, 'wants', 900, 1],
			[null, 'needs', 50, 1]
		]);
		expect(rows[0].archived).toBe(false);
	});
});
