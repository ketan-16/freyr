import type { DatabaseSync } from 'node:sqlite';
import { mulBP, type Paise } from '$lib/money';
import { monthlyActuals, type MonthActuals } from './ledger';

export type PeriodSource = 'base' | 'promotion' | 'manual';

export interface Period {
	id: number;
	effectiveFrom: string;
	needsBP: number;
	wantsBP: number;
	investBP: number;
	source: PeriodSource;
}

/**
 * On a shared effective date a hand-typed correction beats a generated row,
 * and a promotion beats the base. Kept identical in SQL and in memory so
 * periodFor and activeFor can never disagree.
 */
const PRECEDENCE_SQL = `CASE source WHEN 'manual' THEN 2 WHEN 'promotion' THEN 1 ELSE 0 END`;
const ORDER_SQL = `ORDER BY effective_from DESC, ${PRECEDENCE_SQL} DESC, id DESC`;

const SELECT_SQL = `SELECT id, effective_from, needs_bp, wants_bp, invest_bp, source
                    FROM budget_periods`;

export function createPeriod(db: DatabaseSync, p: Omit<Period, 'id' | 'source'>): number {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(p.effectiveFrom))
		throw new Error('Effective-from must be YYYY-MM-DD.');
	const sum = p.needsBP + p.wantsBP + p.investBP;
	if (sum !== 10000)
		throw new Error(`Percentages must sum to 100% (got ${(sum / 100).toFixed(2)}%).`);
	const result = db
		.prepare(
			`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp)
			 VALUES (?, ?, ?, ?)`
		)
		.run(p.effectiveFrom, p.needsBP, p.wantsBP, p.investBP);
	return Number(result.lastInsertRowid);
}

export function listPeriods(db: DatabaseSync): Period[] {
	const rows = db.prepare(`${SELECT_SQL} ${ORDER_SQL}`).all() as Record<string, unknown>[];
	return rows.map(mapPeriod);
}

export function activeFor(db: DatabaseSync, date: string): Period | null {
	const row = db
		.prepare(`${SELECT_SQL} WHERE effective_from <= ? ${ORDER_SQL} LIMIT 1`)
		.get(date) as Record<string, unknown> | undefined;
	return row ? mapPeriod(row) : null;
}

/**
 * The period in force on a date, from an already-fetched list. listPeriods
 * returns rows in the same precedence order activeFor applies, so the first
 * match wins — this lets a caller resolve twelve months with zero extra queries.
 */
export function periodFor(periods: Period[], date: string): Period | null {
	return periods.find((p) => p.effectiveFrom <= date) ?? null;
}

function mapPeriod(r: Record<string, unknown>): Period {
	return {
		id: r.id as number,
		effectiveFrom: r.effective_from as string,
		needsBP: r.needs_bp as number,
		wantsBP: r.wants_bp as number,
		investBP: r.invest_bp as number,
		source: r.source as PeriodSource
	};
}

export interface Allocation {
	needs: Paise;
	wants: Paise;
	invest: Paise;
}

export function allocate(
	income: Paise,
	p: Pick<Period, 'needsBP' | 'wantsBP' | 'investBP'>
): Allocation {
	return {
		needs: mulBP(income, p.needsBP),
		wants: mulBP(income, p.wantsBP),
		invest: mulBP(income, p.investBP)
	};
}

export interface BucketRow {
	bucket: 'needs' | 'wants' | 'investments';
	label: string;
	bp: number | null;
	allocated: Paise | null;
	actual: Paise;
	remaining: Paise | null;
}

export interface MonthSummary {
	year: number;
	month: number;
	income: Paise;
	period: Period | null;
	rows: BucketRow[];
}

/** Everything the Monthly view and Home dashboard show for one month. */
export function monthSummary(db: DatabaseSync, year: number, month: number): MonthSummary {
	const actuals = monthlyActuals(db, year, month);
	const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
	const period = activeFor(db, monthStart);
	const allocation = period ? allocate(actuals.income, period) : null;

	const rows: BucketRow[] = (
		[
			['needs', 'Needs', period?.needsBP ?? null, allocation?.needs ?? null, actuals.needs],
			['wants', 'Wants', period?.wantsBP ?? null, allocation?.wants ?? null, actuals.wants],
			[
				'investments',
				'Investments',
				period?.investBP ?? null,
				allocation?.invest ?? null,
				actuals.invest
			]
		] as const
	).map(([bucket, label, bp, allocated, actual]) => ({
		bucket,
		label,
		bp,
		allocated,
		actual,
		remaining: allocated == null ? null : allocated - actual
	}));

	return { year, month, income: actuals.income, period, rows };
}

export interface YearlyBucketRow {
	bucket: 'needs' | 'wants' | 'investments';
	label: string;
	/**
	 * The year's plan for this bucket, summed month by month. null when no period
	 * was in force for any month of the year: no plan is a different fact from a
	 * plan of zero, and only one of them is true.
	 */
	allocated: Paise | null;
	actual: Paise;
	/**
	 * allocated − actual — the same figure, name and sign `monthSummary` reports,
	 * so an overspend reads identically on the monthly and yearly pages. null
	 * when there is no plan to have anything left of.
	 */
	remaining: Paise | null;
	/**
	 * allocated ÷ income, in basis points — the blended weight the year actually
	 * ran at across however many splits were in force. null when income was zero
	 * or no period covered the year, because there is no share of nothing: 0
	 * would read as "took no share" and a bare divide would give NaN.
	 */
	effectiveBP: number | null;
}

/**
 * How much of a year's recorded activity a budget period was in force for.
 * `empty` is a year with no transactions at all — nothing to cover, and nothing
 * to warn anybody about.
 */
export type YearCoverage = 'empty' | 'none' | 'partial' | 'full';

export interface YearlyAllocation {
	income: Paise;
	rows: YearlyBucketRow[];
	/** Income that never reached a bucket — the gap plan-vs-actual hides. */
	unallocated: Paise;
	coverage: YearCoverage;
	/**
	 * Months that have data but no period in force. Their income and spend are
	 * still counted; nothing is allocated against them, so a page has to say so
	 * rather than let the missing plan read as an overspend.
	 */
	uncoveredMonths: number[];
}

/**
 * Sums each month's own allocation rather than applying one rate to the year.
 * With a promotion mid-year the two differ, and only this one is right: the
 * months before the raise were budgeted at the old split. Each month rounds
 * through mulBP once, so the total is a sum of exact paise and is never
 * re-rounded.
 *
 * Pure over already-fetched rows, so the page costs one grouped query plus one
 * period fetch however many months have data.
 *
 * Months no period covers are reported rather than silently skipped. Folding
 * them in as an allocation of zero would make the year's entire spend read as
 * an overspend against a budget nobody ever set — which is exactly what a year
 * imported from before the earliest period looks like.
 */
export function yearlyAllocation(
	periods: Period[],
	months: MonthActuals[],
	year: number
): YearlyAllocation {
	const mm = (m: number) => String(m).padStart(2, '0');
	let income = 0;
	let covered = 0;
	const uncoveredMonths: number[] = [];
	const allocated = { needs: 0, wants: 0, invest: 0 };
	const actual = { needs: 0, wants: 0, invest: 0 };

	for (const month of months) {
		income += month.income;
		actual.needs += month.needs;
		actual.wants += month.wants;
		actual.invest += month.invest;

		const period = periodFor(periods, `${year}-${mm(month.month)}-01`);
		if (!period) {
			uncoveredMonths.push(month.month);
			continue;
		}
		covered++;
		const share = allocate(month.income, period);
		allocated.needs += share.needs;
		allocated.wants += share.wants;
		allocated.invest += share.invest;
	}

	// Nothing covered means there is no plan, so every allocation-derived figure
	// is absent rather than zero. Partial coverage keeps the real partial plan —
	// no allocation is invented for the months that had none.
	const hasPlan = covered > 0;
	const effective = (a: Paise) => (income === 0 ? null : Math.round((a * 10000) / income));
	const rows: YearlyBucketRow[] = (
		[
			['needs', 'Needs', allocated.needs, actual.needs],
			['wants', 'Wants', allocated.wants, actual.wants],
			['investments', 'Investments', allocated.invest, actual.invest]
		] as const
	).map(([bucket, label, alloc, act]) => ({
		bucket,
		label,
		allocated: hasPlan ? alloc : null,
		actual: act,
		remaining: hasPlan ? alloc - act : null,
		effectiveBP: hasPlan ? effective(alloc) : null
	}));

	return {
		income,
		rows,
		unallocated: income - (actual.needs + actual.wants + actual.invest),
		coverage:
			months.length === 0
				? 'empty'
				: uncoveredMonths.length === 0
					? 'full'
					: covered === 0
						? 'none'
						: 'partial',
		uncoveredMonths
	};
}
