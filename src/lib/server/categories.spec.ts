import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	createCategory,
	deleteCategory,
	ensureCategory,
	getCategory,
	listCategories,
	listCategoryUsage,
	renameCategory,
	setCategoryArchived
} from './categories';
import { createTransaction } from './ledger';
import { testDb } from './test-db';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

describe('createCategory', () => {
	it('scopes the name, so the same word can live under two buckets', () => {
		const needs = createCategory(db, { scope: 'needs', name: 'Travel' });
		const wants = createCategory(db, { scope: 'wants', name: 'Travel' });
		expect(needs).not.toBe(wants);
		expect(listCategories(db).map((c) => [c.scope, c.name])).toEqual([
			['needs', 'Travel'],
			['wants', 'Travel']
		]);
	});

	it('trims the name and rejects a blank one', () => {
		const id = createCategory(db, { scope: 'wants', name: '  Eating out  ' });
		expect(getCategory(db, id)?.name).toBe('Eating out');
		expect(() => createCategory(db, { scope: 'wants', name: '   ' })).toThrow(/name/i);
	});

	it('rejects a duplicate within one scope with a readable message', () => {
		createCategory(db, { scope: 'needs', name: 'Grocery' });
		expect(() => createCategory(db, { scope: 'needs', name: 'Grocery' })).toThrow(
			/already exists/i
		);
	});

	it('rejects an unknown scope', () => {
		expect(() => createCategory(db, { scope: 'rent' as never, name: 'Grocery' })).toThrow(/scope/i);
	});

	it('accepts an income source as a scope', () => {
		const id = createCategory(db, { scope: 'side_hustle', name: 'Freelance' });
		expect(getCategory(db, id)?.scope).toBe('side_hustle');
	});
});

describe('listCategories', () => {
	it('orders by scope then name, and hides archived rows', () => {
		createCategory(db, { scope: 'wants', name: 'Eating out' });
		const fuel = createCategory(db, { scope: 'needs', name: 'Fuel' });
		createCategory(db, { scope: 'job', name: 'Salary' });
		createCategory(db, { scope: 'needs', name: 'Grocery' });
		setCategoryArchived(db, fuel, true);

		expect(listCategories(db).map((c) => c.name)).toEqual(['Grocery', 'Eating out', 'Salary']);
	});
});

describe('listCategoryUsage', () => {
	it('counts the transactions on each category and keeps archived rows', () => {
		const grocery = createCategory(db, { scope: 'needs', name: 'Grocery' });
		const fuel = createCategory(db, { scope: 'needs', name: 'Fuel' });
		setCategoryArchived(db, fuel, true);
		for (const date of ['2026-07-01', '2026-07-02'])
			createTransaction(db, {
				date,
				amountPaise: 1000,
				direction: 'outflow',
				bucket: 'needs',
				categoryId: grocery
			});

		expect(listCategoryUsage(db).map((c) => [c.name, c.used, c.archived])).toEqual([
			['Fuel', 0, true],
			['Grocery', 2, false]
		]);
	});
});

describe('renameCategory', () => {
	it('renames in place, so every transaction on it follows', () => {
		const id = createCategory(db, { scope: 'wants', name: 'Eating out' });
		createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 1000,
			direction: 'outflow',
			bucket: 'wants',
			categoryId: id
		});

		renameCategory(db, id, '  Dining  ');
		expect(getCategory(db, id)?.name).toBe('Dining');
		expect(listCategoryUsage(db)[0].used).toBe(1);
	});

	it('rejects a blank name or a clash inside the scope', () => {
		const id = createCategory(db, { scope: 'wants', name: 'Eating out' });
		createCategory(db, { scope: 'wants', name: 'Travel' });
		createCategory(db, { scope: 'needs', name: 'Dining' });

		expect(() => renameCategory(db, id, ' ')).toThrow(/name/i);
		expect(() => renameCategory(db, id, 'Travel')).toThrow(/already exists/i);
		// The clash is per scope: Dining is taken under needs, not under wants.
		expect(() => renameCategory(db, id, 'Dining')).not.toThrow();
	});
});

describe('deleteCategory', () => {
	it('deletes an unused category', () => {
		const id = createCategory(db, { scope: 'wants', name: 'Eating out' });
		deleteCategory(db, id);
		expect(getCategory(db, id)).toBeNull();
	});

	it('refuses to delete one a transaction still points at', () => {
		const id = createCategory(db, { scope: 'wants', name: 'Eating out' });
		createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 1000,
			direction: 'outflow',
			bucket: 'wants',
			categoryId: id
		});

		expect(() => deleteCategory(db, id)).toThrow(/archive/i);
		expect(getCategory(db, id)).not.toBeNull();
	});
});

describe('setCategoryArchived', () => {
	it('hides then restores a category without touching its transactions', () => {
		const id = createCategory(db, { scope: 'wants', name: 'Eating out' });
		createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 1000,
			direction: 'outflow',
			bucket: 'wants',
			categoryId: id
		});

		setCategoryArchived(db, id, true);
		expect(listCategories(db)).toHaveLength(0);
		expect(listCategoryUsage(db)[0].used).toBe(1);

		setCategoryArchived(db, id, false);
		expect(listCategories(db).map((c) => c.name)).toEqual(['Eating out']);
	});
});

describe('ensureCategory', () => {
	it('is idempotent within a scope and separate across scopes', () => {
		const a = ensureCategory(db, 'needs', 'Grocery');
		const b = ensureCategory(db, 'needs', 'Grocery');
		const c = ensureCategory(db, 'wants', 'Grocery');
		expect(a).toBe(b);
		expect(c).not.toBe(a);
	});
});
