/** Local-timezone date helpers (dates are plain YYYY-MM-DD strings app-wide). */

export function todayISO(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
