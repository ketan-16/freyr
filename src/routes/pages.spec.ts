import { isRedirect } from '@sveltejs/kit';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPeriod } from '$lib/server/budgets';
import { createGoal, ensureLocation } from '$lib/server/goals';
import { createTransaction, listTransactions } from '$lib/server/ledger';
import { createLending } from '$lib/server/registry';
import { testDb } from '$lib/server/test-db';
import * as home from './+page.server';
import * as ledger from './ledger/+page.server';
import * as monthly from './monthly/+page.server';
import * as budget from './settings/budget/+page.server';
import * as yearly from './yearly/+page.server';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function event(url: string, form?: Record<string, string>): any {
	const request = new Request(`http://localhost${url}`, {
		method: form ? 'POST' : 'GET',
		body: form ? new URLSearchParams(form) : undefined
	});
	return {
		locals: { db, user: { id: 1, username: 'test' } },
		url: new URL(`http://localhost${url}`),
		request
	};
}

function seedJuly(): void {
	createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 2720, wantsBP: 3000, investBP: 4280 });
	createTransaction(db, {
		date: '2026-07-01',
		amountPaise: 10000000,
		direction: 'income',
		incomeSource: 'job'
	});
	createTransaction(db, {
		date: '2026-07-05',
		amountPaise: 3061300,
		direction: 'outflow',
		bucket: 'needs'
	});
}

describe('ledger page', () => {
	it('load returns filtered transactions with defaults', () => {
		seedJuly();
		const data = ledger.load(event('/ledger?year=2026&month=7')) as any;
		expect(data.transactions).toHaveLength(2);
		expect(data.filters).toEqual({ year: 2026, month: 7 });
	});

	it('create action inserts and redirects preserving filters', async () => {
		await expect(
			ledger.actions.create(
				event('/ledger?/create&year=2026&month=7', {
					date: '2026-07-10',
					amount: '1,250.50',
					direction: 'outflow',
					bucket: 'wants',
					category: 'Eating out',
					note: 'dinner'
				})
			)
		).rejects.toSatisfy(
			(e: unknown) => isRedirect(e) && e.location === '/ledger?year=2026&month=7'
		);

		const [txn] = listTransactions(db, { year: 2026, month: 7 });
		expect(txn.amountPaise).toBe(125050);
		expect(txn.categoryName).toBe('Eating out');
	});

	it('create action fails with the entered values on bad input', async () => {
		const result = (await ledger.actions.create(
			event('/ledger', {
				date: '2026-07-10',
				amount: 'abc',
				direction: 'outflow',
				bucket: 'wants'
			})
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/amount/i);
		expect(result.data.values.amount).toBe('abc');
	});

	it('goal contributions require a location (friendly error)', async () => {
		const goalId = createGoal(db, { name: 'Car', kind: 'goal' });
		const result = (await ledger.actions.create(
			event('/ledger', {
				date: '2026-07-10',
				amount: '100',
				direction: 'outflow',
				bucket: 'investments',
				goal: String(goalId)
			})
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/location/i);
	});

	it('delete action removes the row', async () => {
		const id = createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 100,
			direction: 'outflow',
			bucket: 'needs'
		});
		await expect(
			ledger.actions.delete(event('/ledger?/delete', { id: String(id) }))
		).rejects.toSatisfy(isRedirect);
		expect(listTransactions(db, {})).toHaveLength(0);
	});
});

describe('monthly page', () => {
	it('computes allocation vs actual with remaining', () => {
		seedJuly();
		const data = monthly.load(event('/monthly?year=2026&month=7')) as any;
		const needs = data.summary.rows.find((r: any) => r.bucket === 'needs');
		expect(needs.allocated).toBe(2720000);
		expect(needs.actual).toBe(3061300);
		expect(needs.remaining).toBe(-341300);
	});

	it('flags a missing budget period', () => {
		const data = monthly.load(event('/monthly?year=2020&month=1')) as any;
		expect(data.summary.period).toBeNull();
	});
});

describe('yearly page', () => {
	it('splits income and lists months with data', () => {
		seedJuly();
		createTransaction(db, {
			date: '2026-03-01',
			amountPaise: 500000,
			direction: 'income',
			incomeSource: 'side_hustle'
		});
		const data = yearly.load(event('/yearly?year=2026')) as any;
		expect(data.summary.job).toBe(10000000);
		expect(data.summary.sideHustle).toBe(500000);
		expect(data.months.map((m: any) => m.month)).toEqual([3, 7]);
	});
});

describe('budget settings page', () => {
	it('creates a period from percent inputs', async () => {
		await expect(
			budget.actions.default(
				event('/settings/budget', {
					effective_from: '2026-01-01',
					needs: '27.20',
					wants: '30',
					invest: '42.80'
				})
			)
		).rejects.toSatisfy(isRedirect);
		const data = budget.load(event('/settings/budget')) as any;
		expect(data.periods).toHaveLength(1);
		expect(data.periods[0].needsBP).toBe(2720);
	});

	it('rejects a bad sum with values preserved', async () => {
		const result = (await budget.actions.default(
			event('/settings/budget', {
				effective_from: '2026-01-01',
				needs: '27.20',
				wants: '30',
				invest: '40'
			})
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/sum to 100/);
		expect(result.data.values.invest).toBe('40');
	});
});

describe('home page', () => {
	it('returns month summary, goal progress and lendings total', () => {
		const goalId = createGoal(db, { name: 'Car', kind: 'goal', targetPaise: 70000000 });
		const bank = ensureLocation(db, 'Bank');
		createTransaction(db, {
			date: '2026-01-15',
			amountPaise: 5000000,
			direction: 'outflow',
			bucket: 'investments',
			goalId,
			locationId: bank
		});
		createLending(db, { person: 'Makarand', principalPaise: 18600000 });

		const data = home.load(event('/')) as any;
		expect(data.goals[0].contributed).toBe(5000000);
		expect(data.lendingsOutstanding).toBe(18600000);
		expect(data.summary.rows).toHaveLength(3);
	});
});
