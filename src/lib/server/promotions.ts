import type { DatabaseSync } from 'node:sqlite';
import { monthStart } from '$lib/dates';
import { assertTriple, weightsAfter, type Policy } from './budget-policy';

export interface Promotion {
	id: number;
	effectiveDate: string;
	incrementBP: number;
	note: string | null;
}

export function getPolicy(db: DatabaseSync): Policy {
	const r = db
		.prepare(
			`SELECT base_effective_from, base_needs_bp, base_wants_bp, base_invest_bp,
			        marg_needs_bp, marg_wants_bp, marg_invest_bp
			 FROM budget_policy WHERE id = 1`
		)
		.get() as Record<string, unknown>;
	return {
		baseEffectiveFrom: r.base_effective_from as string,
		base: {
			needsBP: r.base_needs_bp as number,
			wantsBP: r.base_wants_bp as number,
			investBP: r.base_invest_bp as number
		},
		marginal: {
			needsBP: r.marg_needs_bp as number,
			wantsBP: r.marg_wants_bp as number,
			investBP: r.marg_invest_bp as number
		}
	};
}

export function updatePolicy(db: DatabaseSync, p: Policy): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(p.baseEffectiveFrom))
		throw new Error('Base effective-from must be YYYY-MM-DD.');
	assertTriple(p.base, 'Base split');
	assertTriple(p.marginal, 'Raise split');

	inTransaction(db, () => {
		db.prepare(
			`UPDATE budget_policy SET base_effective_from = ?,
			   base_needs_bp = ?, base_wants_bp = ?, base_invest_bp = ?,
			   marg_needs_bp = ?, marg_wants_bp = ?, marg_invest_bp = ?
			 WHERE id = 1`
		).run(
			p.baseEffectiveFrom,
			p.base.needsBP,
			p.base.wantsBP,
			p.base.investBP,
			p.marginal.needsBP,
			p.marginal.wantsBP,
			p.marginal.investBP
		);
		project(db);
	});
}

/** Newest first, matching how the settings page lists them. */
export function listPromotions(db: DatabaseSync): Promotion[] {
	const rows = db
		.prepare(
			`SELECT id, effective_date, increment_bp, note
			 FROM promotions ORDER BY effective_date DESC`
		)
		.all() as Record<string, unknown>[];
	return rows.map((r) => ({
		id: r.id as number,
		effectiveDate: r.effective_date as string,
		incrementBP: r.increment_bp as number,
		note: (r.note as string | null) ?? null
	}));
}

export function createPromotion(
	db: DatabaseSync,
	p: { effectiveDate: string; incrementBP: number; note?: string | null }
): number {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(p.effectiveDate))
		throw new Error('Effective date must be YYYY-MM-DD.');
	if (!Number.isInteger(p.incrementBP) || p.incrementBP <= 0)
		throw new Error('Raise must be greater than zero.');

	return inTransaction(db, () => {
		const result = db
			.prepare('INSERT INTO promotions (effective_date, increment_bp, note) VALUES (?, ?, ?)')
			.run(p.effectiveDate, p.incrementBP, p.note ?? null);
		project(db);
		return Number(result.lastInsertRowid);
	});
}

export function deletePromotion(db: DatabaseSync, id: number): void {
	inTransaction(db, () => {
		// The period row goes with it via ON DELETE CASCADE; project() rebuilds
		// the rest, since every later period's weights depended on this raise.
		db.prepare('DELETE FROM promotions WHERE id = ?').run(id);
		project(db);
	});
}

export function rebuildProjectedPeriods(db: DatabaseSync): void {
	inTransaction(db, () => project(db));
}

function inTransaction<T>(db: DatabaseSync, fn: () => T): T {
	db.exec('BEGIN');
	try {
		const out = fn();
		db.exec('COMMIT');
		return out;
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}
}

/**
 * Rewrites every generated period from the promotion log. Manual rows are left
 * alone, so a hand-typed correction survives any number of rebuilds.
 *
 * Two promotions inside one month collapse to a single period carrying both
 * raises: the month is the finest granularity the monthly view resolves, and
 * the later promotion's cumulative fold already includes the earlier one.
 *
 * Caller must hold a transaction.
 */
function project(db: DatabaseSync): void {
	const policy = getPolicy(db);
	const ascending = listPromotions(db).reverse();

	db.exec(`DELETE FROM budget_periods WHERE source IN ('base', 'promotion')`);

	const insert = db.prepare(
		`INSERT INTO budget_periods
		   (effective_from, needs_bp, wants_bp, invest_bp, source, promotion_id)
		 VALUES (?, ?, ?, ?, ?, ?)`
	);

	const base = weightsAfter(policy, []);
	insert.run(policy.baseEffectiveFrom, base.needsBP, base.wantsBP, base.investBP, 'base', null);

	const increments: number[] = [];
	const byMonth = new Map<
		string,
		{ needsBP: number; wantsBP: number; investBP: number; id: number }
	>();
	for (const promotion of ascending) {
		increments.push(promotion.incrementBP);
		// Later promotions in the same month overwrite earlier ones, keeping the
		// fully compounded weights and the last promotion as the owning row.
		byMonth.set(monthStart(promotion.effectiveDate), {
			...weightsAfter(policy, increments),
			id: promotion.id
		});
	}

	for (const [effectiveFrom, w] of byMonth)
		insert.run(effectiveFrom, w.needsBP, w.wantsBP, w.investBP, 'promotion', w.id);
}
