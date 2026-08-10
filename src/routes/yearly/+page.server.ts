import { todayISO } from '$lib/dates';
import { listPeriods, yearlyAllocation } from '$lib/server/budgets';
import { priorYear } from '$lib/server/comparison';
import { monthlyActualsForYear, years, yearlySummary } from '$lib/server/ledger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const today = todayISO();
	const allYears = years(locals.db);
	const fallback = allYears.at(-1) ?? Number(today.slice(0, 4));
	const year = Number(url.searchParams.get('year')) || fallback;

	// One grouped query for every month that has data, replacing the
	// twelve-round-trip loop this page used to run.
	const months = monthlyActualsForYear(locals.db, year);

	return {
		year,
		// The picker must be able to sit on the year it is showing, even one the
		// ledger has no rows for (an empty database, or a hand-typed ?year=).
		years: allYears.includes(year) ? allYears : [...allYears, year].sort((a, b) => a - b),
		summary: yearlySummary(locals.db, year),
		months,
		// Pure over the rows already fetched: no query per month, no query per
		// period.
		allocation: yearlyAllocation(listPeriods(locals.db), months, year),
		// A year in progress compares against the same span of days; a completed
		// year compares whole against whole.
		prior: priorYear(locals.db, year, today)
	};
};
