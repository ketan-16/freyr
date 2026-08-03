import { dayBoundIn, daysInMonth, MONTH_NAMES, prevMonth, todayISO } from '$lib/dates';
import { monthSummary } from '$lib/server/budgets';
import { goalProgress, listGoals, listLocations } from '$lib/server/goals';
import { listCategories, listTransactions, monthlyActuals } from '$lib/server/ledger';
import { openLendingsTotal } from '$lib/server/registry';
import { createFromForm } from '$lib/server/txn-form';
import { fail, redirect } from '@sveltejs/kit';
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

	// Like-for-like: a month in progress is compared against the same span of
	// days one month back, never against a completed month.
	const prev = prevMonth(year, month);
	const priorActuals = monthlyActuals(
		locals.db,
		prev.year,
		prev.month,
		dayBoundIn(prev.year, prev.month, day)
	);

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
		prior: {
			label: MONTH_NAMES[prev.month - 1],
			spent: priorActuals.needs + priorActuals.wants + priorActuals.invest
		},
		goals: goalProgress(locals.db),
		lendingsOutstanding: openLendingsTotal(locals.db),
		recent: listTransactions(locals.db, { limit: RECENT }),
		entry: {
			today,
			categories: listCategories(locals.db),
			goals: listGoals(locals.db).filter((g) => g.status === 'active'),
			locations: listLocations(locals.db)
		}
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const values = Object.fromEntries(
			[...form.entries()].map(([k, v]) => [k, String(v)])
		) as Record<string, string>;

		try {
			createFromForm(locals.db, values);
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : String(err), values });
		}
		redirect(303, '/');
	}
};
