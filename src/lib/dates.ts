/** Local-timezone date helpers (dates are plain YYYY-MM-DD strings app-wide). */

function iso(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO(): string {
	return iso(new Date());
}

export const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

export function monthLabel(year: number, month: number): string {
	return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function prevMonth(year: number, month: number): { year: number; month: number } {
	return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function nextMonth(year: number, month: number): { year: number; month: number } {
	return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/**
 * The first of the month containing an ISO date. A raise landing mid-month
 * applies to that whole month's pay, so promotions snap here.
 */
export function monthStart(iso: string): string {
	return `${iso.slice(0, 7)}-01`;
}

/** Number of days in a month. Day 0 of the next month is the last of this one. */
export function daysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

/**
 * Exclusive upper bound covering days 1…`dayOfMonth` of the given month, for
 * like-for-like comparison against a period in progress. The day is clamped to
 * the month's own length, so "through the 31st" of a February means all of it.
 */
export function dayBoundIn(year: number, month: number, dayOfMonth: number): string {
	const day = Math.min(dayOfMonth, daysInMonth(year, month));
	return iso(new Date(year, month - 1, day + 1));
}
