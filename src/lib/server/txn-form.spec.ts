import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCategory } from './categories';
import { listTransactions } from './ledger';
import { testDb } from './test-db';
import { createFromForm, entryOptions } from './txn-form';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

describe('createFromForm', () => {
	it('builds a bucketed outflow with its category', () => {
		const eatingOut = createCategory(db, { scope: 'wants', name: 'Eating out' });

		createFromForm(db, {
			date: '2026-07-10',
			amount: '1,250.50',
			direction: 'outflow',
			bucket: 'wants',
			category: String(eatingOut),
			note: '  dinner  '
		});

		const [txn] = listTransactions(db, {});
		expect(txn.amountPaise).toBe(125050);
		expect(txn.categoryName).toBe('Eating out');
		expect(txn.note).toBe('dinner');
		expect(txn.bucket).toBe('wants');
	});

	it('builds income with a source, its category, and no bucket', () => {
		const salary = createCategory(db, { scope: 'job', name: 'Salary' });

		createFromForm(db, {
			date: '2026-07-01',
			amount: '50000',
			direction: 'income',
			source: 'job',
			category: String(salary),
			// A stale bucket value from the form must not stick to income.
			bucket: 'needs'
		});

		const [txn] = listTransactions(db, {});
		expect(txn.direction).toBe('income');
		expect(txn.bucket).toBeNull();
		expect(txn.incomeSource).toBe('job');
		expect(txn.categoryName).toBe('Salary');
	});

	it('requires a category on both directions', () => {
		expect(() =>
			createFromForm(db, {
				date: '2026-07-10',
				amount: '100',
				direction: 'outflow',
				bucket: 'wants',
				category: ''
			})
		).toThrow(/category/i);

		expect(() =>
			createFromForm(db, {
				date: '2026-07-10',
				amount: '100',
				direction: 'income',
				source: 'job'
			})
		).toThrow(/category/i);
	});

	it('refuses a category scoped to something else', () => {
		const grocery = createCategory(db, { scope: 'needs', name: 'Grocery' });
		const salary = createCategory(db, { scope: 'job', name: 'Salary' });

		expect(() =>
			createFromForm(db, {
				date: '2026-07-10',
				amount: '100',
				direction: 'outflow',
				bucket: 'wants',
				category: String(grocery)
			})
		).toThrow(/not a wants category/i);

		expect(() =>
			createFromForm(db, {
				date: '2026-07-10',
				amount: '100',
				direction: 'income',
				source: 'side_hustle',
				category: String(salary)
			})
		).toThrow(/not a side hustle category/i);
	});

	it('refuses a category that has since been deleted', () => {
		expect(() =>
			createFromForm(db, {
				date: '2026-07-10',
				amount: '100',
				direction: 'outflow',
				bucket: 'wants',
				category: '999'
			})
		).toThrow(/no longer exists/i);
	});

	it('leaves a missing bucket or source to the domain to report', () => {
		expect(() =>
			createFromForm(db, { date: '2026-07-10', amount: '100', direction: 'outflow' })
		).toThrow(/bucket/i);
		expect(() =>
			createFromForm(db, { date: '2026-07-10', amount: '100', direction: 'income' })
		).toThrow(/source/i);
	});

	it('throws on an unparseable amount before asking for a category', () => {
		expect(() =>
			createFromForm(db, {
				date: '2026-07-10',
				amount: 'abc',
				direction: 'outflow',
				bucket: 'wants'
			})
		).toThrow(/amount/i);
	});
});

describe('entryOptions', () => {
	it('carries every scope in one list, archived ones excluded', () => {
		createCategory(db, { scope: 'wants', name: 'Eating out' });
		createCategory(db, { scope: 'job', name: 'Salary' });

		const options = entryOptions(db, '2026-07-10');
		expect(options.today).toBe('2026-07-10');
		expect(options.categories.map((c) => [c.scope, c.name])).toEqual([
			['wants', 'Eating out'],
			['job', 'Salary']
		]);
	});
});
