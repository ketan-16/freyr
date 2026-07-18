import { todayISO } from '$lib/dates';
import { monthlyActuals, monthsWithData, years, yearlySummary } from '$lib/server/ledger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const allYears = years(locals.db);
	const fallback = allYears.at(-1) ?? Number(todayISO().slice(0, 4));
	const year = Number(url.searchParams.get('year')) || fallback;
	const months = monthsWithData(locals.db, year).map((month) => ({
		month,
		actuals: monthlyActuals(locals.db, year, month)
	}));
	return { year, years: allYears, summary: yearlySummary(locals.db, year), months };
};
