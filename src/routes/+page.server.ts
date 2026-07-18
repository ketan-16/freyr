import { todayISO } from '$lib/dates';
import { monthSummary } from '$lib/server/budgets';
import { goalProgress } from '$lib/server/goals';
import { openLendingsTotal } from '$lib/server/registry';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const today = todayISO();
	return {
		summary: monthSummary(locals.db, Number(today.slice(0, 4)), Number(today.slice(5, 7))),
		goals: goalProgress(locals.db),
		lendingsOutstanding: openLendingsTotal(locals.db)
	};
};
