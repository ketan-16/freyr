import { todayISO } from '$lib/dates';
import { monthSummary } from '$lib/server/budgets';
import { priorMonth } from '$lib/server/comparison';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const today = todayISO();
	const year = Number(url.searchParams.get('year')) || Number(today.slice(0, 4));
	const month = Number(url.searchParams.get('month')) || Number(today.slice(5, 7));

	const isCurrentMonth = year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7));

	const summary = monthSummary(locals.db, year, month);

	return {
		summary,
		isCurrentMonth,
		// Allocation is a share of the income booked in the month, so with none
		// booked every bucket allocates 0 and remaining folds to 0 − actual.
		// Home reads that as awaiting income rather than three blown budgets;
		// monthly must not contradict it.
		awaitingIncome: summary.income === 0,
		// A month in progress compares against the same span of days; a
		// completed month compares whole against whole.
		prior: priorMonth(locals.db, year, month, today)
	};
};
