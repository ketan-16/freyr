/**
 * The prior-period comparison shared by every page that shows "vs last
 * month/year": resolve the period before, bound it to the same span of days
 * when the target period is still in progress, and fold the buckets into one
 * figure. A completed period always compares whole against whole — never
 * partial against complete.
 */

import type { DatabaseSync } from 'node:sqlite';
import { dayBoundIn, MONTH_NAMES, prevMonth } from '$lib/dates';
import type { Paise } from '$lib/money';
import { monthlyActuals, yearlySummary } from './ledger';

export interface PriorPeriod {
	/** Human label for the period compared against — e.g. "July" or "2025". */
	label: string;
	income: Paise;
	spent: Paise;
}

/** The month before (year, month), day-bounded when (year, month) is the current month. */
export function priorMonth(
	db: DatabaseSync,
	year: number,
	month: number,
	today: string
): PriorPeriod {
	const isCurrent = year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7));
	const prev = prevMonth(year, month);
	const through = isCurrent
		? dayBoundIn(prev.year, prev.month, Number(today.slice(8, 10)))
		: undefined;
	const actuals = monthlyActuals(db, prev.year, prev.month, through);
	return {
		label: MONTH_NAMES[prev.month - 1],
		income: actuals.income,
		spent: actuals.needs + actuals.wants + actuals.invest
	};
}

/** The year before `year`, day-bounded when `year` is the current year. */
export function priorYear(db: DatabaseSync, year: number, today: string): PriorPeriod {
	const isCurrent = year === Number(today.slice(0, 4));
	const prevYear = year - 1;
	const through = isCurrent
		? dayBoundIn(prevYear, Number(today.slice(5, 7)), Number(today.slice(8, 10)))
		: undefined;
	const actuals = yearlySummary(db, prevYear, through);
	return {
		label: String(prevYear),
		income: actuals.job + actuals.sideHustle,
		spent: actuals.needs + actuals.wants + actuals.invest
	};
}
