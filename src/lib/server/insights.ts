/**
 * Read-only rollups behind the charts. Every function is one grouped query over
 * a half-open date range, so it rides `idx_transactions_date` and costs the
 * rows in that range — never the whole ledger — and nothing is stored.
 *
 * Income counts only `job` and `side_hustle`, exactly as `monthlyActuals` does,
 * so a chart can never disagree with the table beside it.
 */

import type { DatabaseSync } from 'node:sqlite';
import type { Paise } from '$lib/money';
import type { Bucket } from './ledger';

const mm = (n: number) => String(n).padStart(2, '0');

/** [first day of the month, first day of the next). */
export function monthRange(year: number, month: number): [string, string] {
	const next = month === 12 ? `${year + 1}-01-01` : `${year}-${mm(month + 1)}-01`;
	return [`${year}-${mm(month)}-01`, next];
}

/** [1 January, 1 January of the next year). */
export function yearRange(year: number): [string, string] {
	return [`${year}-01-01`, `${year + 1}-01-01`];
}

/** The same four sums every rollup in the app carries. */
const TOTALS_SQL = `
	COALESCE(SUM(CASE WHEN direction = 'income' AND income_source IN ('job', 'side_hustle')
	                  THEN amount_paise ELSE 0 END), 0) AS income,
	COALESCE(SUM(CASE WHEN bucket = 'needs' THEN amount_paise ELSE 0 END), 0) AS needs,
	COALESCE(SUM(CASE WHEN bucket = 'wants' THEN amount_paise ELSE 0 END), 0) AS wants,
	COALESCE(SUM(CASE WHEN bucket = 'investments' THEN amount_paise ELSE 0 END), 0) AS invest`;

export interface DayTotals {
	day: number;
	income: Paise;
	needs: Paise;
	wants: Paise;
	invest: Paise;
}

/** One month, day by day. Days with no rows are absent rather than zero-filled. */
export function dailyTotals(db: DatabaseSync, year: number, month: number): DayTotals[] {
	const [start, end] = monthRange(year, month);
	return db
		.prepare(
			`SELECT CAST(substr(date, 9, 2) AS INTEGER) AS day, ${TOTALS_SQL}
			 FROM transactions WHERE date >= ? AND date < ?
			 GROUP BY day ORDER BY day`
		)
		.all(start, end) as unknown as DayTotals[];
}

export interface MonthTotals {
	year: number;
	month: number;
	income: Paise;
	needs: Paise;
	wants: Paise;
	invest: Paise;
}

/**
 * Month by month across any range — a trend that crosses New Year, which
 * `monthlyActualsForYear` cannot. Months with no rows are absent.
 */
export function monthlyTotals(db: DatabaseSync, start: string, end: string): MonthTotals[] {
	return db
		.prepare(
			`SELECT CAST(substr(date, 1, 4) AS INTEGER) AS year,
			        CAST(substr(date, 6, 2) AS INTEGER) AS month, ${TOTALS_SQL}
			 FROM transactions WHERE date >= ? AND date < ?
			 GROUP BY year, month ORDER BY year, month`
		)
		.all(start, end) as unknown as MonthTotals[];
}

export interface CategoryTotal {
	/** null for rows filed under no category — imported history, mostly. */
	categoryId: number | null;
	name: string | null;
	bucket: Bucket;
	archived: boolean;
	total: Paise;
	count: number;
}

/**
 * Outflow per category, largest first. Grouped by bucket as well, so rows with
 * no category form one line per bucket rather than one anonymous heap.
 */
export function outflowByCategory(db: DatabaseSync, start: string, end: string): CategoryTotal[] {
	const rows = db
		.prepare(
			`SELECT t.category_id, c.name, c.archived, t.bucket,
			        SUM(t.amount_paise) AS total, COUNT(*) AS count
			 FROM transactions t
			 LEFT JOIN categories c ON c.id = t.category_id
			 WHERE t.direction = 'outflow' AND t.date >= ? AND t.date < ?
			 GROUP BY t.bucket, t.category_id
			 ORDER BY total DESC, c.name`
		)
		.all(start, end) as Record<string, unknown>[];
	return rows.map((r) => ({
		categoryId: r.category_id as number | null,
		name: r.name as string | null,
		bucket: r.bucket as Bucket,
		archived: r.archived === 1,
		total: r.total as number,
		count: r.count as number
	}));
}
