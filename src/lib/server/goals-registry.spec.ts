import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGoal, ensureLocation, goalProgress, listGoals } from './goals';
import { createTransaction } from './ledger';
import { createLending, openLendingsTotal } from './registry';
import { testDb } from './test-db';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

describe('goals', () => {
	it('creates and lists goals; rejects duplicates', () => {
		createGoal(db, { name: 'Car', kind: 'goal', targetPaise: 70000000 });
		createGoal(db, { name: 'Bike', kind: 'pot', targetPaise: 15000000 });
		expect(listGoals(db).map((g) => g.name)).toEqual(['Bike', 'Car']);
		expect(() => createGoal(db, { name: 'Car', kind: 'goal' })).toThrow();
	});

	it('ensureLocation is idempotent', () => {
		expect(ensureLocation(db, 'Bank')).toBe(ensureLocation(db, 'Bank'));
	});

	it('goalProgress sums contributions per active goal', () => {
		const car = createGoal(db, { name: 'Car', kind: 'goal', targetPaise: 70000000 });
		createGoal(db, { name: 'Archived', kind: 'goal', status: 'archived' });
		const bank = ensureLocation(db, 'Bank');
		createTransaction(db, {
			date: '2026-01-15',
			amountPaise: 5000000,
			direction: 'outflow',
			bucket: 'investments',
			goalId: car,
			locationId: bank
		});
		createTransaction(db, {
			date: '2026-04-15',
			amountPaise: 2500000,
			direction: 'outflow',
			bucket: 'investments',
			goalId: car,
			locationId: bank
		});

		const progress = goalProgress(db);
		expect(progress).toHaveLength(1);
		expect(progress[0].goal.name).toBe('Car');
		expect(progress[0].contributed).toBe(7500000);
	});
});

describe('lendings', () => {
	it('openLendingsTotal is principal minus repayments for open lendings', () => {
		const lending = createLending(db, { person: 'Makarand', principalPaise: 18600000 });
		createTransaction(db, {
			date: '2026-02-01',
			amountPaise: 1000000,
			direction: 'income',
			incomeSource: 'other',
			lendingId: lending
		});
		createTransaction(db, {
			date: '2026-03-01',
			amountPaise: 2550000,
			direction: 'income',
			incomeSource: 'other',
			lendingId: lending
		});
		expect(openLendingsTotal(db)).toBe(15050000);
	});

	it('rejects a non-positive principal', () => {
		expect(() => createLending(db, { person: 'X', principalPaise: 0 })).toThrow();
	});
});
