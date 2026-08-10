import { daysInMonth, todayISO } from '$lib/dates';
import { monthSummary } from '$lib/server/budgets';
import { priorMonth } from '$lib/server/comparison';
import { goalProgress } from '$lib/server/goals';
import { listTransactions } from '$lib/server/ledger';
import { openLendingsTotal } from '$lib/server/registry';
import { createTxnAction, entryOptions } from '$lib/server/txn-form';
import type { Actions, PageServerLoad } from './$types';

/** How many rows the recent-activity list shows. Bounded so the query stays constant-cost. */
const RECENT = 8;

export const load: PageServerLoad = ({ locals }) => {
	const today = todayISO();
	const year = Number(today.slice(0, 4));
	const month = Number(today.slice(5, 7));
	const day = Number(today.slice(8, 10));

	const summary = monthSummary(locals.db, year, month);
	const spent = summary.rows.reduce((total, row) => total + row.actual, 0);

	return {
		summary,
		today,
		day,
		daysInMonth: daysInMonth(year, month),
		spent,
		// Allocation derives from income actually booked, so before payday there
		// is nothing to allocate. Say so rather than showing every bucket as
		// overspent against a zero budget.
		awaitingIncome: summary.income === 0,
		// Like-for-like: a month in progress is compared against the same span
		// of days one month back, never against a completed month.
		prior: priorMonth(locals.db, year, month, today),
		goals: goalProgress(locals.db),
		lendingsOutstanding: openLendingsTotal(locals.db),
		recent: listTransactions(locals.db, { limit: RECENT }),
		entry: entryOptions(locals.db, today)
	};
};

export const actions: Actions = {
	create: ({ request, locals }) => createTxnAction(request, locals.db, '/')
};
