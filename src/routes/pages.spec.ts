import { isHttpError, isRedirect } from '@sveltejs/kit';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dayBoundIn, daysInMonth, MONTH_NAMES, prevMonth, todayISO } from '$lib/dates';
import { activeFor, createPeriod } from '$lib/server/budgets';
import { createCategory, getCategory, listCategories } from '$lib/server/categories';
import { createGoal, ensureLocation } from '$lib/server/goals';
import { createTransaction, getTransaction, listTransactions } from '$lib/server/ledger';
import { createPromotion, rebuildProjectedPeriods } from '$lib/server/promotions';
import { createLending } from '$lib/server/registry';
import { testDb } from '$lib/server/test-db';
import * as home from './+page.server';
import * as ledger from './ledger/+page.server';
import * as edit from './ledger/[id]/+page.server';
import * as monthly from './monthly/+page.server';
import * as budget from './settings/budget/+page.server';
import * as categories from './settings/categories/+page.server';
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
		const eatingOut = createCategory(db, { scope: 'wants', name: 'Eating out' });
		await expect(
			ledger.actions.create(
				event('/ledger?/create&year=2026&month=7', {
					date: '2026-07-10',
					amount: '1,250.50',
					direction: 'outflow',
					bucket: 'wants',
					category: String(eatingOut),
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

	it('refuses an entry with no category, or one from another bucket', async () => {
		const grocery = createCategory(db, { scope: 'needs', name: 'Grocery' });
		const base = { date: '2026-07-10', amount: '100', direction: 'outflow', bucket: 'wants' };

		const missing = (await ledger.actions.create(event('/ledger', base))) as any;
		expect(missing.status).toBe(400);
		expect(missing.data.error).toMatch(/category/i);

		const mismatched = (await ledger.actions.create(
			event('/ledger', { ...base, category: String(grocery) })
		)) as any;
		expect(mismatched.status).toBe(400);
		expect(mismatched.data.error).toMatch(/not a wants category/i);
		expect(listTransactions(db, {})).toHaveLength(0);
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

describe('transaction edit page', () => {
	function seedRow(): { id: number; grocery: number; eatingOut: number } {
		const grocery = createCategory(db, { scope: 'needs', name: 'Grocery' });
		const eatingOut = createCategory(db, { scope: 'wants', name: 'Eating out' });
		const id = createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 100,
			direction: 'outflow',
			bucket: 'needs',
			categoryId: grocery
		});
		return { id, grocery, eatingOut };
	}

	function editEvent(id: number, url: string, form?: Record<string, string>): any {
		return { ...event(url, form), params: { id: String(id) } };
	}

	it('loads the row, its categories and the month to return to', () => {
		const { id } = seedRow();
		const data = edit.load(editEvent(id, `/ledger/${id}`)) as any;
		expect(data.txn).toMatchObject({ id, amountPaise: 100, categoryName: 'Grocery' });
		expect(data.back).toBe('/ledger?year=2026&month=7');
		expect(data.entry.categories).toHaveLength(2);

		const scoped = edit.load(editEvent(id, `/ledger/${id}?year=2026&month=8&bucket=needs`)) as any;
		expect(scoped.back).toBe('/ledger?year=2026&month=8&bucket=needs');
	});

	it('is a 404 for a row that does not exist', () => {
		expect.assertions(1);
		try {
			edit.load(editEvent(999, '/ledger/999'));
		} catch (e) {
			expect(isHttpError(e) && e.status === 404).toBe(true);
		}
	});

	it('update action edits the row and redirects to the ledger month', async () => {
		const { id, eatingOut } = seedRow();
		await expect(
			edit.actions.update(
				editEvent(id, `/ledger/${id}?/update&year=2026&month=7`, {
					id: String(id),
					date: '2026-07-02',
					amount: '450',
					direction: 'outflow',
					bucket: 'wants',
					category: String(eatingOut),
					note: 'lunch'
				})
			)
		).rejects.toSatisfy(
			(e: unknown) => isRedirect(e) && e.location === '/ledger?year=2026&month=7'
		);

		expect(getTransaction(db, id)).toMatchObject({
			amountPaise: 45000,
			categoryName: 'Eating out',
			note: 'lunch'
		});
	});

	it('update action fails with the entered values and leaves the row alone', async () => {
		const { id, grocery } = seedRow();
		const result = (await edit.actions.update(
			editEvent(id, `/ledger/${id}?/update`, {
				id: String(id),
				date: '2026-07-01',
				amount: 'abc',
				direction: 'outflow',
				bucket: 'needs',
				category: String(grocery)
			})
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/amount/i);
		expect(result.data.values.amount).toBe('abc');
		expect(getTransaction(db, id)?.amountPaise).toBe(100);
	});

	it('delete action removes the row and returns to its month', async () => {
		const { id } = seedRow();
		await expect(edit.actions.delete(editEvent(id, `/ledger/${id}?/delete`, {}))).rejects.toSatisfy(
			(e: unknown) => isRedirect(e) && e.location === '/ledger?year=2026&month=7'
		);
		expect(getTransaction(db, id)).toBeNull();
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

	// The Left tile folds the rows' remaining rather than computing income −
	// spent, so a month no period covers has nothing to fold and the tile shows
	// a dash. Income is booked here on purpose: the awaiting-income flag alone
	// says nothing is wrong, which is how "Left ₹3,000" once printed above a
	// table whose every Allocated and Remaining cell was a dash.
	it('leaves a month no budget period covers without an allocation basis', () => {
		createPeriod(db, { effectiveFrom: '2026-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: '2025-11-02',
			amountPaise: 300000,
			direction: 'income',
			incomeSource: 'job'
		});

		const data = monthly.load(event('/monthly?year=2025&month=11')) as any;
		expect(data.summary.period).toBeNull();
		expect(data.awaitingIncome).toBe(false);
		expect(data.summary.rows.every((r: any) => r.remaining === null)).toBe(true);
		expect(data.summary.rows.reduce((t: number, r: any) => t + (r.remaining ?? 0), 0)).toBe(0);
	});

	// The other half of the same rule: three roundings that each fall short leave
	// the shares a paisa under income, so income − spent and the sum of the rows
	// are different numbers. The tile folds the rows, so it agrees with them.
	it('allocates a paisa short of income when every share rounds down', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 4500, wantsBP: 3000, investBP: 2500 });
		createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 100001,
			direction: 'income',
			incomeSource: 'job'
		});

		const data = monthly.load(event('/monthly?year=2026&month=7')) as any;
		const rows = data.summary.rows as { allocated: number; remaining: number }[];
		expect(data.summary.income).toBe(100001);
		expect(rows.reduce((t, r) => t + r.allocated, 0)).toBe(100000);
		expect(rows.reduce((t, r) => t + r.remaining, 0)).toBe(100000);
	});

	it('reports awaiting-income for a month with no income booked', () => {
		createPeriod(db, { effectiveFrom: '2020-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: '2026-07-03',
			amountPaise: 482000,
			direction: 'outflow',
			bucket: 'needs'
		});

		const data = monthly.load(event('/monthly?year=2026&month=7')) as any;
		expect(data.awaitingIncome).toBe(true);
		// A period in force with no income allocates zero, so remaining folds to
		// −actual. That raw figure is the "three blown budgets" the flag exists to
		// suppress in the markup; the domain still reports it faithfully.
		const needs = data.summary.rows.find((r: any) => r.bucket === 'needs');
		expect(needs.remaining).toBe(-482000);
	});

	it('clears awaiting-income once income lands', () => {
		seedJuly();
		const data = monthly.load(event('/monthly?year=2026&month=7')) as any;
		expect(data.awaitingIncome).toBe(false);
	});

	it('carries the month day by day, by category, and the six months to it', () => {
		seedJuly();
		const data = monthly.load(event('/monthly?year=2026&month=7')) as any;
		expect(data.daily.map((d: any) => d.day)).toEqual([1, 5]);
		expect(data.spendByCategory).toEqual([
			expect.objectContaining({ bucket: 'needs', total: 3061300, categoryId: null })
		]);
		expect(data.trend).toEqual([
			{ year: 2026, month: 7, income: 10000000, needs: 3061300, wants: 0, invest: 0 }
		]);
	});
});

describe('monthly comparison', () => {
	it('compares a completed month against the whole prior month', () => {
		createTransaction(db, {
			date: '2026-06-20',
			amountPaise: 700000,
			direction: 'outflow',
			bucket: 'wants'
		});
		createTransaction(db, {
			date: '2026-07-05',
			amountPaise: 300000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const data = monthly.load(event('/monthly?year=2026&month=7')) as any;
		expect(data.isCurrentMonth).toBe(false);
		expect(data.prior.spent).toBe(700000);
		expect(data.prior.label).toBe('June');
	});

	// The current-month branch depends on today's date, so it seeds relative to
	// today rather than at fixed dates that would drift out of range.
	it('bounds the prior month to the same day when the month is current', () => {
		const today = todayISO();
		const prev = prevMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
		const day = Number(today.slice(8, 10));
		// The bound is exclusive, so the day it names is the first day left out
		// and the day before it is the last one counted — whatever today is.
		const firstExcluded = dayBoundIn(prev.year, prev.month, day);
		const lastCounted = `${prev.year}-${String(prev.month).padStart(2, '0')}-${String(
			Math.min(day, daysInMonth(prev.year, prev.month))
		).padStart(2, '0')}`;

		createTransaction(db, {
			date: lastCounted,
			amountPaise: 500000,
			direction: 'outflow',
			bucket: 'needs'
		});
		createTransaction(db, {
			date: firstExcluded,
			amountPaise: 900000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const data = monthly.load(event('/monthly')) as any;
		expect(data.isCurrentMonth).toBe(true);
		expect(data.prior.spent).toBe(500000);
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

describe('yearly rollup', () => {
	it('returns per-bucket allocation alongside the month rows', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: '2026-03-01',
			amountPaise: 10000000,
			direction: 'income',
			incomeSource: 'job'
		});
		createTransaction(db, {
			date: '2026-03-05',
			amountPaise: 4000000,
			direction: 'outflow',
			bucket: 'needs'
		});

		const data = yearly.load(event('/yearly?year=2026')) as any;
		expect(data.allocation.rows).toHaveLength(3);
		const needs = data.allocation.rows.find((r: any) => r.bucket === 'needs');
		expect(needs.allocated).toBe(5000000);
		expect(needs.actual).toBe(4000000);
		// Remaining is allocated − actual, the same figure and sign the monthly
		// page shows, so ₹10,000 under plan is positive on both.
		expect(needs.remaining).toBe(1000000);
		// allocated ÷ income: the blended allocation share, not the share spent.
		expect(needs.effectiveBP).toBe(5000);
	});

	it('reports income the buckets never absorbed as unallocated', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: '2026-03-01',
			amountPaise: 10000000,
			direction: 'income',
			incomeSource: 'job'
		});
		// An `other` inflow, which neither income definition counts. Without one
		// the two independently-written SQL definitions agree trivially and the
		// identity below cannot fail; with one, a change to either breaks it.
		createTransaction(db, {
			date: '2026-04-02',
			amountPaise: 2500000,
			direction: 'income',
			incomeSource: 'other'
		});
		createTransaction(db, {
			date: '2026-03-05',
			amountPaise: 4000000,
			direction: 'outflow',
			bucket: 'needs'
		});

		const data = yearly.load(event('/yearly?year=2026')) as any;
		expect(data.allocation.income).toBe(10000000);
		expect(data.allocation.unallocated).toBe(6000000);
		// The page describes this figure instead of printing it, on the grounds
		// that it is the Net headline — income minus the buckets' actuals. Guard
		// the identity so that claim cannot quietly become false.
		const spent = data.allocation.rows.reduce((t: number, r: any) => t + r.actual, 0);
		expect(data.allocation.unallocated).toBe(data.summary.job + data.summary.sideHustle - spent);
	});

	// A year the ledger has no rows for is still a year the picker must be able
	// to sit on — otherwise the select renders with nothing selected.
	it('offers the requested year in the picker even with no rows in it', () => {
		seedJuly();
		const data = yearly.load(event('/yearly?year=2019')) as any;
		expect(data.year).toBe(2019);
		expect(data.years).toEqual([2019, 2026]);
	});
});

describe('yearly budget coverage', () => {
	// Reachable in practice: years imported from before the earliest budget
	// period. Previously every bucket showed an allocation of ₹0 and a 0.00%
	// share, so the year's whole spend read as a blown budget nobody had set.
	it('reports no plan for a year no budget period covers', () => {
		createPeriod(db, { effectiveFrom: '2026-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: '2019-04-02',
			amountPaise: 900000,
			direction: 'income',
			incomeSource: 'job'
		});
		createTransaction(db, {
			date: '2019-04-09',
			amountPaise: 300000,
			direction: 'outflow',
			bucket: 'needs'
		});

		const data = yearly.load(event('/yearly?year=2019')) as any;
		expect(data.allocation.coverage).toBe('none');
		expect(data.allocation.rows.every((r: any) => r.allocated === null)).toBe(true);
		expect(data.allocation.rows.every((r: any) => r.remaining === null)).toBe(true);
		// Income was booked, so the old fold divided by it and produced a real
		// 0.00% share rather than an absent one.
		expect(data.allocation.rows.every((r: any) => r.effectiveBP === null)).toBe(true);
	});

	it('names the uncovered months when a period starts mid-year', () => {
		createPeriod(db, { effectiveFrom: '2026-06-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: '2026-02-01',
			amountPaise: 900000,
			direction: 'income',
			incomeSource: 'job'
		});
		createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 900000,
			direction: 'income',
			incomeSource: 'job'
		});

		const data = yearly.load(event('/yearly?year=2026')) as any;
		expect(data.allocation.coverage).toBe('partial');
		expect(data.allocation.uncoveredMonths).toEqual([2]);
		// July's half alone — February is left out rather than allocated at a
		// rate that was not in force.
		const needs = data.allocation.rows.find((r: any) => r.bucket === 'needs');
		expect(needs.allocated).toBe(450000);
		// Nothing was spent, so remaining is the partial plan intact. It is the
		// partial plan minus *every* month's spending, which is why the notice
		// tells the reader this column reads low.
		expect(needs.remaining).toBe(450000);
	});

	it('reports awaiting-income for a year with spending but none booked', () => {
		createPeriod(db, { effectiveFrom: '2025-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: '2026-02-11',
			amountPaise: 450000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const data = yearly.load(event('/yearly?year=2026')) as any;
		expect(data.awaitingIncome).toBe(true);
		// A period is in force, so it allocates a real share of zero income. The
		// domain reports the resulting −actual faithfully; the page suppresses it,
		// exactly as home and monthly do.
		const wants = data.allocation.rows.find((r: any) => r.bucket === 'wants');
		expect(wants.remaining).toBe(-450000);
	});

	it('does not claim a year with no transactions at all is uncovered', () => {
		createPeriod(db, { effectiveFrom: '2026-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		const data = yearly.load(event('/yearly?year=2019')) as any;
		expect(data.allocation.coverage).toBe('empty');
		expect(data.awaitingIncome).toBe(false);
	});
});

describe('yearly comparison', () => {
	it('compares a completed year whole against whole', () => {
		// Last year is finished whatever today is, so this exercises the
		// unbounded branch without depending on the current date.
		const year = Number(todayISO().slice(0, 4)) - 1;
		const mm = (m: number) => String(m).padStart(2, '0');
		// The last day of the year before it: a same-span-of-days bound would
		// clip this on every day but New Year's Eve, so counting it shows the
		// completed year was compared whole.
		createTransaction(db, {
			date: `${year - 1}-12-31`,
			amountPaise: 200000,
			direction: 'outflow',
			bucket: 'wants'
		});
		createTransaction(db, {
			date: `${year}-${mm(6)}-01`,
			amountPaise: 500000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const data = yearly.load(event(`/yearly?year=${year}`)) as any;
		expect(data.prior.label).toBe(String(year - 1));
		expect(data.prior.spent).toBe(200000);
	});

	// The current-year branch depends on today's date, so it seeds relative to
	// today rather than at fixed dates that would drift out of range.
	it('bounds the prior year to the same span of days when the year is in progress', () => {
		const today = todayISO();
		const year = Number(today.slice(0, 4));
		const month = Number(today.slice(5, 7));
		const day = Number(today.slice(8, 10));
		// The bound is exclusive, so the day it names is the first day left out
		// and the day before it is the last one counted — whatever today is.
		const firstExcluded = dayBoundIn(year - 1, month, day);
		const lastCounted = `${year - 1}-${String(month).padStart(2, '0')}-${String(
			Math.min(day, daysInMonth(year - 1, month))
		).padStart(2, '0')}`;

		createTransaction(db, {
			date: lastCounted,
			amountPaise: 500000,
			direction: 'outflow',
			bucket: 'needs'
		});
		createTransaction(db, {
			date: firstExcluded,
			amountPaise: 900000,
			direction: 'outflow',
			bucket: 'wants'
		});

		const data = yearly.load(event(`/yearly?year=${year}`)) as any;
		expect(data.prior.label).toBe(String(year - 1));
		expect(data.prior.spent).toBe(500000);
	});
});

describe('budget settings page', () => {
	it('creates a manual period from percent inputs', async () => {
		await expect(
			budget.actions.addPeriod(
				event('/settings/budget?/addPeriod', {
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
		expect(data.periods[0].source).toBe('manual');
	});

	it('rejects a bad sum with values preserved, on the period form', async () => {
		const result = (await budget.actions.addPeriod(
			event('/settings/budget?/addPeriod', {
				effective_from: '2026-01-01',
				needs: '27.20',
				wants: '30',
				invest: '40'
			})
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/sum to 100/);
		expect(result.data.values.invest).toBe('40');
		// Four forms post to this page; only the one that failed shows the message.
		expect(result.data.failed).toBe('addPeriod');
	});
});

describe('/settings/budget promotions', () => {
	// Production gets this for free: `hooks.server.ts` rebuilds the projection
	// once per process, straight after `migrate()`. A test database is opened by
	// `testDb()` and never passes through the hook, so the base row this asserts
	// has to be projected here.
	it('loads policy, promotions and periods together', () => {
		rebuildProjectedPeriods(db);
		const data = budget.load(event('/settings/budget')) as any;
		expect(data.policy.marginal.investBP).toBe(5000);
		expect(data.promotions).toEqual([]);
		expect(data.periods.some((p: { source: string }) => p.source === 'base')).toBe(true);
	});

	it('addPromotion projects a period and redirects', async () => {
		await expect(
			budget.actions.addPromotion(
				event('/settings/budget?/addPromotion', {
					effective_date: '2025-09-15',
					increment: '20',
					note: ' first raise '
				})
			)
		).rejects.toSatisfy(isRedirect);
		expect(activeFor(db, '2025-09-01')?.source).toBe('promotion');
		const data = budget.load(event('/settings/budget')) as any;
		expect(data.promotions[0].note).toBe('first raise');
	});

	it('carries the split each raise produced', () => {
		createPromotion(db, { effectiveDate: '2025-09-15', incrementBP: 2000 });
		const data = budget.load(event('/settings/budget')) as any;
		// 50/30/20 base pulled 20% of the way to a 20/30/50 margin.
		expect(data.promotions[0].weights).toEqual({ needsBP: 4500, wantsBP: 3000, investBP: 2500 });
	});

	it('reports a bad raise without throwing, keeping what was typed', async () => {
		const result = (await budget.actions.addPromotion(
			event('/settings/budget?/addPromotion', { effective_date: '2025-09-15', increment: '0' })
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/greater than zero/);
		expect(result.data.values.increment).toBe('0');
		expect(result.data.failed).toBe('addPromotion');
	});

	it('deletePromotion drops the raise and reprojects', async () => {
		const id = createPromotion(db, { effectiveDate: '2025-09-15', incrementBP: 2000 });
		await expect(
			budget.actions.deletePromotion(event('/settings/budget?/deletePromotion', { id: String(id) }))
		).rejects.toSatisfy(isRedirect);
		// The projected period went with it, leaving the base row in force.
		expect(activeFor(db, '2025-09-01')?.source).toBe('base');
	});

	it('savePolicy stores the split and reprojects every period', async () => {
		createPromotion(db, { effectiveDate: '2025-09-15', incrementBP: 2000 });
		await expect(
			budget.actions.savePolicy(
				event('/settings/budget?/savePolicy', {
					base_effective_from: '2021-09-01',
					base_needs: '50',
					base_wants: '30',
					base_invest: '20',
					marg_needs: '50',
					marg_wants: '30',
					marg_invest: '20'
				})
			)
		).rejects.toSatisfy(isRedirect);
		// A raise split equal to the base never moves the weights, so the raise's
		// own period now carries the base ones.
		expect(activeFor(db, '2025-09-01')?.needsBP).toBe(5000);
	});

	it('savePolicy reports a base date that would orphan a raise', async () => {
		createPromotion(db, { effectiveDate: '2025-09-15', incrementBP: 2000 });
		const result = (await budget.actions.savePolicy(
			event('/settings/budget?/savePolicy', {
				base_effective_from: '2026-01-01',
				base_needs: '50',
				base_wants: '30',
				base_invest: '20',
				marg_needs: '20',
				marg_wants: '30',
				marg_invest: '50'
			})
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/2025-09-15/);
		expect(result.data.values.base_effective_from).toBe('2026-01-01');
		expect(result.data.failed).toBe('savePolicy');
	});
});

describe('categories settings page', () => {
	it('load returns every category with its usage, and the scopes on offer', () => {
		const grocery = createCategory(db, { scope: 'needs', name: 'Grocery' });
		createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 100,
			direction: 'outflow',
			bucket: 'needs',
			categoryId: grocery
		});

		const data = categories.load(event('/settings/categories')) as any;
		expect(data.categories).toEqual([
			{ id: grocery, scope: 'needs', name: 'Grocery', archived: false, used: 1 }
		]);
		// 'other' income is never offered by the entry bar, so it is not offered here.
		expect(data.scopes.map((s: any) => s.value)).toEqual([
			'needs',
			'wants',
			'investments',
			'job',
			'side_hustle'
		]);
	});

	it('add creates one, and reports a duplicate keeping what was typed', async () => {
		await expect(
			categories.actions.add(
				event('/settings/categories?/add', { scope: 'wants', name: 'Eating out' })
			)
		).rejects.toSatisfy(isRedirect);
		expect(listCategories(db).map((c) => c.name)).toEqual(['Eating out']);

		const result = (await categories.actions.add(
			event('/settings/categories?/add', { scope: 'wants', name: 'Eating out' })
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.failed).toBe('add');
		expect(result.data.error).toMatch(/already exists/i);
		expect(result.data.values.name).toBe('Eating out');
	});

	it('rename keeps the transactions filed under it', async () => {
		const id = createCategory(db, { scope: 'wants', name: 'Eating out' });
		createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 100,
			direction: 'outflow',
			bucket: 'wants',
			categoryId: id
		});

		await expect(
			categories.actions.rename(
				event('/settings/categories?/rename', { id: String(id), name: 'Dining' })
			)
		).rejects.toSatisfy(isRedirect);
		expect(listTransactions(db, {})[0].categoryName).toBe('Dining');
	});

	it('archive hides a category from the entry bar and restores it', async () => {
		const id = createCategory(db, { scope: 'wants', name: 'Eating out' });

		await expect(
			categories.actions.archive(
				event('/settings/categories?/archive', { id: String(id), archived: '1' })
			)
		).rejects.toSatisfy(isRedirect);
		expect(listCategories(db)).toHaveLength(0);

		await expect(
			categories.actions.archive(
				event('/settings/categories?/archive', { id: String(id), archived: '0' })
			)
		).rejects.toSatisfy(isRedirect);
		expect(listCategories(db)).toHaveLength(1);
	});

	it('delete removes an unused one and refuses a used one', async () => {
		const spare = createCategory(db, { scope: 'wants', name: 'Spare' });
		const used = createCategory(db, { scope: 'wants', name: 'Eating out' });
		createTransaction(db, {
			date: '2026-07-01',
			amountPaise: 100,
			direction: 'outflow',
			bucket: 'wants',
			categoryId: used
		});

		await expect(
			categories.actions.delete(event('/settings/categories?/delete', { id: String(spare) }))
		).rejects.toSatisfy(isRedirect);
		expect(getCategory(db, spare)).toBeNull();

		const result = (await categories.actions.delete(
			event('/settings/categories?/delete', { id: String(used) })
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.failed).toBe('delete');
		expect(result.data.error).toMatch(/archive it instead/i);
		expect(getCategory(db, used)).not.toBeNull();
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

describe('home command centre', () => {
	// `/` always loads the real current month, so these seed relative to today
	// rather than at fixed dates that would drift out of range.
	const today = todayISO();
	const year = Number(today.slice(0, 4));
	const month = Number(today.slice(5, 7));

	it('compares this month against the same days of last month', () => {
		const prev = prevMonth(year, month);
		// The 1st of last month falls inside "through the same day" for any
		// day-of-month today can be.
		const prevFirst = `${prev.year}-${String(prev.month).padStart(2, '0')}-01`;
		createTransaction(db, {
			date: prevFirst,
			amountPaise: 800000,
			direction: 'outflow',
			bucket: 'needs'
		});

		const data = home.load(event('/')) as any;
		expect(data.prior.spent).toBe(800000);
		expect(data.prior.label).toBe(MONTH_NAMES[prev.month - 1]);
	});

	it('reports awaiting-income when no income is booked yet', () => {
		createPeriod(db, { effectiveFrom: '2020-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: today,
			amountPaise: 350000,
			direction: 'outflow',
			bucket: 'needs'
		});

		const data = home.load(event('/')) as any;
		expect(data.awaitingIncome).toBe(true);
		expect(data.spent).toBe(350000);
		// Allocation is a share of booked income, so zero income allocates zero
		// even with a period in force. `formatCell` renders that 0 as an em
		// dash, which is exactly the "nothing here yet" the state needs — no
		// special-casing in the markup.
		expect(data.summary.rows.every((r: any) => r.allocated === 0)).toBe(true);
	});

	it('clears awaiting-income once income lands', () => {
		createPeriod(db, { effectiveFrom: '2020-01-01', needsBP: 5000, wantsBP: 3000, investBP: 2000 });
		createTransaction(db, {
			date: today,
			amountPaise: 10000000,
			direction: 'income',
			incomeSource: 'job'
		});

		const data = home.load(event('/')) as any;
		expect(data.awaitingIncome).toBe(false);
	});

	it('has no allocation basis when income is booked but no period covers the month', () => {
		createTransaction(db, {
			date: today,
			amountPaise: 10000000,
			direction: 'income',
			incomeSource: 'job'
		});

		const data = home.load(event('/')) as any;
		// Income was booked, so this is not the awaiting-income state — yet with
		// no period there is nothing to allocate by, and every row's allocated
		// and remaining are null. Folding those to 0 would make the hero claim
		// "₹0 left of ₹0 allocated", a figure nobody recorded. The markup keys
		// its branch on exactly these two facts.
		expect(data.awaitingIncome).toBe(false);
		expect(data.summary.period).toBeNull();
		expect(data.summary.rows.every((r: any) => r.allocated === null)).toBe(true);
	});

	it('returns a bounded recent-activity list, newest first', () => {
		for (let d = 1; d <= 10; d++) {
			createTransaction(db, {
				date: `2026-01-${String(d).padStart(2, '0')}`,
				amountPaise: d * 1000,
				direction: 'outflow',
				bucket: 'needs'
			});
		}

		const data = home.load(event('/')) as any;
		expect(data.recent).toHaveLength(8);
		expect(data.recent[0].date).toBe('2026-01-10');
	});

	it('create action inserts and redirects home', async () => {
		const eatingOut = createCategory(db, { scope: 'wants', name: 'Eating out' });
		await expect(
			home.actions.create(
				event('/?/create', {
					date: '2026-07-10',
					amount: '1,250.50',
					direction: 'outflow',
					bucket: 'wants',
					category: String(eatingOut)
				})
			)
		).rejects.toSatisfy((e: unknown) => isRedirect(e) && e.location === '/');

		expect(listTransactions(db, {})).toHaveLength(1);
	});

	it('create action fails with the entered values preserved', async () => {
		const result = (await home.actions.create(
			event('/?/create', {
				date: '2026-07-10',
				amount: 'abc',
				direction: 'outflow',
				bucket: 'wants'
			})
		)) as any;
		expect(result.status).toBe(400);
		expect(result.data.values.amount).toBe('abc');
	});
});
