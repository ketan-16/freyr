import type { DatabaseSync } from 'node:sqlite';
import type { Paise } from '$lib/money';

export type Direction = 'income' | 'outflow';
export type Bucket = 'needs' | 'wants' | 'investments';
export type Source = 'job' | 'side_hustle' | 'other';

export const BUCKETS: Bucket[] = ['needs', 'wants', 'investments'];
export const SOURCES: Source[] = ['job', 'side_hustle', 'other'];

export interface TxnInput {
	date: string;
	amountPaise: Paise;
	direction: Direction;
	bucket?: Bucket | null;
	incomeSource?: Source | null;
	note?: string | null;
	imported?: boolean;
	categoryId?: number | null;
	goalId?: number | null;
	locationId?: number | null;
	lendingId?: number | null;
}

export interface Txn {
	id: number;
	date: string;
	amountPaise: Paise;
	direction: Direction;
	bucket: Bucket | null;
	incomeSource: Source | null;
	note: string | null;
	imported: boolean;
	categoryId: number | null;
	goalId: number | null;
	locationId: number | null;
	lendingId: number | null;
	/**
	 * The only joined name a row carries: it is the only one any screen prints.
	 * Goal, location and lending names were joined for a ledger column that no
	 * longer exists — goal progress reads them from `goals` instead.
	 */
	categoryName: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Domain validation mirroring the SQLite CHECKs, with friendlier messages. */
function validate(t: TxnInput): void {
	if (!DATE_RE.test(t.date)) throw new Error('Date must be YYYY-MM-DD.');
	if (!Number.isInteger(t.amountPaise) || t.amountPaise <= 0)
		throw new Error('Amount must be a positive amount in whole paise.');
	if (t.direction === 'income') {
		if (t.bucket) throw new Error('Income cannot have a bucket.');
		if (!t.incomeSource) throw new Error('Income needs a source.');
	} else if (t.direction === 'outflow') {
		if (!t.bucket) throw new Error('Outflows need a bucket.');
		if (t.incomeSource) throw new Error('Outflows cannot have an income source.');
	} else {
		throw new Error('Direction must be income or outflow.');
	}
	if ((t.goalId == null) !== (t.locationId == null))
		throw new Error('Goal contributions need both a goal and a location.');
}

export function createTransaction(db: DatabaseSync, t: TxnInput): number {
	validate(t);
	const result = db
		.prepare(
			`INSERT INTO transactions
			 (date, amount_paise, direction, bucket, income_source, note, imported,
			  category_id, goal_id, location_id, lending_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			t.date,
			t.amountPaise,
			t.direction,
			t.bucket ?? null,
			t.incomeSource ?? null,
			t.note ?? null,
			t.imported ? 1 : 0,
			t.categoryId ?? null,
			t.goalId ?? null,
			t.locationId ?? null,
			t.lendingId ?? null
		);
	return Number(result.lastInsertRowid);
}

export function deleteTransaction(db: DatabaseSync, id: number): void {
	db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
}

/**
 * The fields the entry form owns. Goal, location, lending and the imported flag
 * are not among them: an edit leaves them as stored, so a contribution stays on
 * its goal and a repayment on its lending.
 */
export type TxnEdit = Pick<
	TxnInput,
	'date' | 'amountPaise' | 'direction' | 'bucket' | 'incomeSource' | 'note' | 'categoryId'
>;

/**
 * Rewrites one transaction's form-owned fields, under the same validation as a
 * new row. A row linked to a goal must stay an outflow, and one linked to a
 * lending must stay income from the same source: goal progress sums
 * contributions and the lending total subtracts repayments, and neither can
 * tell which way a row flows or whether the rollups also count it.
 */
export function updateTransaction(db: DatabaseSync, id: number, t: TxnEdit): void {
	validate(t);
	const current = db
		.prepare('SELECT goal_id, lending_id, income_source FROM transactions WHERE id = ?')
		.get(id) as
		{ goal_id: number | null; lending_id: number | null; income_source: Source | null } | undefined;
	if (!current) throw new Error('That transaction no longer exists.');
	if (current.goal_id != null && t.direction !== 'outflow')
		throw new Error('A goal contribution has to stay an outflow.');
	// Its source too: turned into job income, a repayment would start counting
	// toward every allocation while still paying the lending down.
	if (
		current.lending_id != null &&
		(t.direction !== 'income' || t.incomeSource !== current.income_source)
	)
		throw new Error('A lending repayment keeps its direction and source.');

	db.prepare(
		`UPDATE transactions
		 SET date = ?, amount_paise = ?, direction = ?, bucket = ?, income_source = ?,
		     note = ?, category_id = ?
		 WHERE id = ?`
	).run(
		t.date,
		t.amountPaise,
		t.direction,
		t.bucket ?? null,
		t.incomeSource ?? null,
		t.note ?? null,
		t.categoryId ?? null,
		id
	);
}

export interface TxnFilter {
	year?: number;
	month?: number;
	bucket?: Bucket;
	/** Newest-first cap, for short activity lists. Keeps the query constant-cost. */
	limit?: number;
}

/** Half-open [start, end) date range for a month or a whole year. */
function dateRange(year: number, month?: number): [string, string] {
	const mm = (m: number) => String(m).padStart(2, '0');
	if (!month) return [`${year}-01-01`, `${year + 1}-01-01`];
	const next = month === 12 ? `${year + 1}-01-01` : `${year}-${mm(month + 1)}-01`;
	return [`${year}-${mm(month)}-01`, next];
}

const SELECT_TXN = `SELECT t.id, t.date, t.amount_paise, t.direction, t.bucket, t.income_source,
        t.note, t.imported, t.category_id, t.goal_id, t.location_id, t.lending_id,
        c.name AS category_name
 FROM transactions t
 LEFT JOIN categories c ON c.id = t.category_id`;

function mapTxn(r: Record<string, unknown>): Txn {
	return {
		id: r.id as number,
		date: r.date as string,
		amountPaise: r.amount_paise as number,
		direction: r.direction as Direction,
		bucket: r.bucket as Bucket | null,
		incomeSource: r.income_source as Source | null,
		note: r.note as string | null,
		imported: r.imported === 1,
		categoryId: r.category_id as number | null,
		goalId: r.goal_id as number | null,
		locationId: r.location_id as number | null,
		lendingId: r.lending_id as number | null,
		categoryName: r.category_name as string | null
	};
}

export function listTransactions(db: DatabaseSync, f: TxnFilter): Txn[] {
	const where: string[] = [];
	const params: (string | number)[] = [];
	if (f.year) {
		const [start, end] = dateRange(f.year, f.month);
		where.push('t.date >= ? AND t.date < ?');
		params.push(start, end);
	}
	if (f.bucket) {
		where.push('t.bucket = ?');
		params.push(f.bucket);
	}
	const rows = db
		.prepare(
			`${SELECT_TXN}
			 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
			 ORDER BY t.date DESC, t.id DESC
			 ${f.limit ? 'LIMIT ?' : ''}`
		)
		.all(...params, ...(f.limit ? [f.limit] : [])) as Record<string, unknown>[];

	return rows.map(mapTxn);
}

/** One transaction by id — the edit page's read. */
export function getTransaction(db: DatabaseSync, id: number): Txn | null {
	const row = db.prepare(`${SELECT_TXN} WHERE t.id = ?`).get(id) as
		Record<string, unknown> | undefined;
	return row ? mapTxn(row) : null;
}

// ---- Rollups (computed, never stored) ----

export interface MonthlyActuals {
	income: Paise;
	needs: Paise;
	wants: Paise;
	invest: Paise;
}

/** Narrows a half-open range by an exclusive bound, ignoring one that falls outside. */
function capped(end: string, through?: string): string {
	return through && through < end ? through : end;
}

export function monthlyActuals(
	db: DatabaseSync,
	year: number,
	month: number,
	through?: string
): MonthlyActuals {
	const [start, end] = dateRange(year, month);
	const row = db
		.prepare(
			`SELECT
			   COALESCE(SUM(CASE WHEN direction = 'income' AND income_source IN ('job', 'side_hustle')
			                     THEN amount_paise ELSE 0 END), 0) AS income,
			   COALESCE(SUM(CASE WHEN bucket = 'needs' THEN amount_paise ELSE 0 END), 0) AS needs,
			   COALESCE(SUM(CASE WHEN bucket = 'wants' THEN amount_paise ELSE 0 END), 0) AS wants,
			   COALESCE(SUM(CASE WHEN bucket = 'investments' THEN amount_paise ELSE 0 END), 0) AS invest
			 FROM transactions WHERE date >= ? AND date < ?`
		)
		.get(start, capped(end, through)) as unknown as MonthlyActuals;
	return row;
}

export interface MonthActuals extends MonthlyActuals {
	month: number;
}

/**
 * Every month of a year that has data, in one pass. The yearly view needs all
 * twelve; querying per month made that page issue a query per month.
 *
 * The per-month figures are identical to monthlyActuals — same CASE arms, same
 * half-open range, same rule that only job and side-hustle income counts.
 * Months with no rows are absent rather than zero-filled, exactly as
 * monthsWithData reports them.
 */
export function monthlyActualsForYear(db: DatabaseSync, year: number): MonthActuals[] {
	const [start, end] = dateRange(year);
	return db
		.prepare(
			`SELECT CAST(substr(date, 6, 2) AS INTEGER) AS month,
			   COALESCE(SUM(CASE WHEN direction = 'income' AND income_source IN ('job', 'side_hustle')
			                     THEN amount_paise ELSE 0 END), 0) AS income,
			   COALESCE(SUM(CASE WHEN bucket = 'needs' THEN amount_paise ELSE 0 END), 0) AS needs,
			   COALESCE(SUM(CASE WHEN bucket = 'wants' THEN amount_paise ELSE 0 END), 0) AS wants,
			   COALESCE(SUM(CASE WHEN bucket = 'investments' THEN amount_paise ELSE 0 END), 0) AS invest
			 FROM transactions WHERE date >= ? AND date < ?
			 GROUP BY month ORDER BY month`
		)
		.all(start, end) as unknown as MonthActuals[];
}

export interface YearlySummary {
	job: Paise;
	sideHustle: Paise;
	needs: Paise;
	wants: Paise;
	invest: Paise;
}

export function yearlySummary(db: DatabaseSync, year: number, through?: string): YearlySummary {
	const [start, end] = dateRange(year);
	const row = db
		.prepare(
			`SELECT
			   COALESCE(SUM(CASE WHEN income_source = 'job' THEN amount_paise ELSE 0 END), 0) AS job,
			   COALESCE(SUM(CASE WHEN income_source = 'side_hustle' THEN amount_paise ELSE 0 END), 0) AS side_hustle,
			   COALESCE(SUM(CASE WHEN bucket = 'needs' THEN amount_paise ELSE 0 END), 0) AS needs,
			   COALESCE(SUM(CASE WHEN bucket = 'wants' THEN amount_paise ELSE 0 END), 0) AS wants,
			   COALESCE(SUM(CASE WHEN bucket = 'investments' THEN amount_paise ELSE 0 END), 0) AS invest
			 FROM transactions WHERE date >= ? AND date < ?`
		)
		.get(start, capped(end, through)) as Record<string, number>;
	return {
		job: row.job,
		sideHustle: row.side_hustle,
		needs: row.needs,
		wants: row.wants,
		invest: row.invest
	};
}

export function years(db: DatabaseSync): number[] {
	const rows = db
		.prepare(
			'SELECT DISTINCT CAST(substr(date, 1, 4) AS INTEGER) AS y FROM transactions ORDER BY y'
		)
		.all() as { y: number }[];
	return rows.map((r) => r.y);
}

export function monthsWithData(db: DatabaseSync, year: number): number[] {
	const [start, end] = dateRange(year);
	const rows = db
		.prepare(
			`SELECT DISTINCT CAST(substr(date, 6, 2) AS INTEGER) AS m
			 FROM transactions WHERE date >= ? AND date < ? ORDER BY m`
		)
		.all(start, end) as { m: number }[];
	return rows.map((r) => r.m);
}
