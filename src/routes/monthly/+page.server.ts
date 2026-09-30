import { addMonths, todayISO } from '$lib/dates';
import { monthSummary } from '$lib/server/budgets';
import { priorMonth } from '$lib/server/comparison';
import { dailyTotals, monthlyTotals, monthRange, outflowByCategory } from '$lib/server/insights';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const today = todayISO();
	const year = Number(url.searchParams.get('year')) || Number(today.slice(0, 4));
	const month = Number(url.searchParams.get('month')) || Number(today.slice(5, 7));

	const isCurrentMonth = year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7));

	const summary = monthSummary(locals.db, year, month);
	const trendFrom = addMonths(year, month, -5);

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
		prior: priorMonth(locals.db, year, month, today),
		today,
		// Chart data: one grouped query each over this month or the six ending
		// at it, so stepping months costs a month of rows at a time.
		daily: dailyTotals(locals.db, year, month),
		spendByCategory: outflowByCategory(locals.db, ...monthRange(year, month)),
		trend: monthlyTotals(
			locals.db,
			monthRange(trendFrom.year, trendFrom.month)[0],
			monthRange(year, month)[1]
		)
	};
};
