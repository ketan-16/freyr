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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A date for a dense table column: `08 Aug`. An ISO string is unambiguous but
 * spends eleven characters, eight of which a month-scoped table already told
 * the reader in its heading — and it right-aligns as a wall of identical
 * prefixes that the eye cannot use to find a row.
 *
 * `contextYear` is the year the surrounding screen is already scoped to. The
 * year is printed whenever the date falls outside it, so a Recent list that
 * crosses New Year stays truthful; pass nothing and it is always printed.
 * Sliced rather than parsed into a `Date` — dates are plain strings app-wide
 * and constructing one here would reintroduce the timezone shift the rest of
 * this module exists to avoid.
 */
export function shortDate(date: string, contextYear?: number): string {
	if (!DATE_RE.test(date)) return date;
	const year = Number(date.slice(0, 4));
	const label = `${date.slice(8, 10)} ${MONTH_NAMES[Number(date.slice(5, 7)) - 1].slice(0, 3)}`;
	return year === contextYear ? label : `${label} ${String(year).slice(2)}`;
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Day of the week, 0 = Sunday, for a year/month/day. Built from local
 * components, so no timezone can move it to the neighbouring day.
 */
export function weekday(year: number, month: number, day: number): number {
	return new Date(year, month - 1, day).getDay();
}

/**
 * A day heading for a statement: `Tue 30 Sep`, with a two-digit year when the
 * date falls outside `contextYear` (the same rule as `shortDate`).
 */
export function dayLabel(date: string, contextYear?: number): string {
	if (!DATE_RE.test(date)) return date;
	const y = Number(date.slice(0, 4));
	const m = Number(date.slice(5, 7));
	const d = Number(date.slice(8, 10));
	return `${WEEKDAYS[weekday(y, m, d)]} ${shortDate(date, contextYear)}`;
}

/** A month label short enough for an axis or a stepper on a phone: `Sep 26`. */
export function shortMonth(year: number, month: number): string {
	return `${MONTH_NAMES[month - 1].slice(0, 3)} ${String(year).slice(2)}`;
}

/** The month `delta` months away from (year, month); negative steps back. */
export function addMonths(
	year: number,
	month: number,
	delta: number
): { year: number; month: number } {
	const index = year * 12 + (month - 1) + delta;
	return { year: Math.floor(index / 12), month: (index % 12) + 1 };
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
