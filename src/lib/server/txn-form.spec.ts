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
