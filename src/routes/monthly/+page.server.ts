import { todayISO } from '$lib/dates';
import { monthSummary } from '$lib/server/budgets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const today = todayISO();
	const year = Number(url.searchParams.get('year')) || Number(today.slice(0, 4));
	const month = Number(url.searchParams.get('month')) || Number(today.slice(5, 7));
	return { summary: monthSummary(locals.db, year, month) };
};
