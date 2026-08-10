import type { DatabaseSync } from 'node:sqlite';
import { monthStart } from '$lib/dates';
import { assertTriple, weightsAfter, type Policy, type TripleBP } from './budget-policy';
import { SQLITE_CONSTRAINT_UNIQUE } from './db';

export interface Promotion {
	id: number;
	effectiveDate: string;
	incrementBP: number;
	note: string | null;
}

/** A raise with the split it produced — itself and every earlier raise folded in. */
export interface PromotionEffect extends Promotion {
	weights: TripleBP;
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
	assertBaseNotAfterPromotions(db, p.baseEffectiveFrom);

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

/**
 * The same invariant createPromotion enforces, from the other side: no projected
 * promotion row may precede the base row. Moving the base forward past a raise
 * breaks it after the fact — the base row would land later and override the
 * raise, silently dropping it from the projection until the next one compounded
 * it back in. Compared the way project() writes them, month start against the
 * base row's own date, so the two guards agree on the boundary.
 *
 * The earliest raise is the binding constraint — it is the first to fall before
 * any base date — so it is the one named. UNIQUE(effective_date) indexes the
 * lookup, so this is one indexed row however long the log gets.
 */
function assertBaseNotAfterPromotions(db: DatabaseSync, baseEffectiveFrom: string): void {
	const row = db
		.prepare('SELECT effective_date FROM promotions ORDER BY effective_date LIMIT 1')
		.get() as { effective_date: string } | undefined;
	if (!row) return;

	const latestLegal = monthStart(row.effective_date);
	if (latestLegal < baseEffectiveFrom)
		throw new Error(
			`The base split cannot start after ${latestLegal}: ` +
				`a raise effective ${row.effective_date} would fall before it.`
		);
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

/**
 * Each raise with the split it produced, oldest first. The fold is cumulative —
 * a raise's weights include every earlier one — which is what makes the closed
 * form drift-free.
 */
function fold(policy: Policy, ascending: Promotion[]): PromotionEffect[] {
	const increments: number[] = [];
	return ascending.map((promotion) => {
		increments.push(promotion.incrementBP);
		return { ...promotion, weights: weightsAfter(policy, increments) };
	});
}

/**
 * The promotion log carrying each raise's resulting split. Newest first, like
 * listPromotions.
 *
 * Folded rather than read back off budget_periods on purpose: two raises inside
 * one month project a single period owned by the later of them, so the
 * projection has no row to attribute to the earlier raise even though it did
 * take effect. The fold gives every raise the split it produced.
 */
export function listPromotionEffects(db: DatabaseSync): PromotionEffect[] {
	return fold(getPolicy(db), listPromotions(db).reverse()).reverse();
}

export function createPromotion(
	db: DatabaseSync,
	p: { effectiveDate: string; incrementBP: number; note?: string | null }
): number {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(p.effectiveDate))
		throw new Error('Effective date must be YYYY-MM-DD.');
	if (!Number.isInteger(p.incrementBP) || p.incrementBP <= 0)
		throw new Error('Raise must be greater than zero.');

	// The invariant: no projected promotion row may precede the base row. One
	// that did would be overridden by the base, silently dropping the raise
	// until a later one compounded it back in. So compare what project() will
	// actually write — the promotion's month start — against the base row's own
	// date. With the usual month-start base that accepts a raise anywhere in the
	// base's own month, since it snaps onto the base's date and wins there on
	// precedence; it still refuses one that would land genuinely earlier.
	const policy = getPolicy(db);
	if (monthStart(p.effectiveDate) < policy.baseEffectiveFrom)
		throw new Error(
			`A raise cannot take effect before the base split starts (${policy.baseEffectiveFrom}).`
		);

	return inTransaction(db, () => {
		const result = insertPromotion(db, p);
		project(db);
		return Number(result.lastInsertRowid);
	});
}

/**
 * Translates the one constraint an ordinary entry can hit into a sentence. The
 * only UNIQUE on promotions is effective_date.
 */
function insertPromotion(
	db: DatabaseSync,
	p: { effectiveDate: string; incrementBP: number; note?: string | null }
) {
	try {
		return db
			.prepare('INSERT INTO promotions (effective_date, increment_bp, note) VALUES (?, ?, ?)')
			.run(p.effectiveDate, p.incrementBP, p.note ?? null);
	} catch (err) {
		if ((err as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE)
			throw new Error(`A raise effective ${p.effectiveDate} already exists.`, { cause: err });
		throw err;
	}
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
		try {
			db.exec('ROLLBACK');
		} catch {
			// SQLite unwinds the transaction itself on some failures (a full or
			// unwritable disk), leaving nothing to roll back. The explicit
			// ROLLBACK then throws "no transaction is active" — swallowing that
			// keeps the propagated error the one that explains why we got here.
		}
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

	const byMonth = new Map<string, TripleBP & { id: number }>();
	for (const effect of fold(policy, ascending)) {
		// Later promotions in the same month overwrite earlier ones, keeping the
		// fully compounded weights and the last promotion as the owning row.
		byMonth.set(monthStart(effect.effectiveDate), { ...effect.weights, id: effect.id });
	}

	for (const [effectiveFrom, w] of byMonth)
		insert.run(effectiveFrom, w.needsBP, w.wantsBP, w.investBP, 'promotion', w.id);
}
