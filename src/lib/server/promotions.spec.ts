import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { activeFor, createPeriod, listPeriods } from './budgets';
import {
	createPromotion,
	deletePromotion,
	getPolicy,
	listPromotionEffects,
	listPromotions,
	rebuildProjectedPeriods,
	updatePolicy
} from './promotions';
import { testDb } from './test-db';

let db: DatabaseSync;

beforeEach(() => {
	db = testDb();
});

afterEach(() => {
	db.close();
});

describe('getPolicy', () => {
	it('reads the seeded 50/30/20 base and 20/30/50 margin', () => {
		expect(getPolicy(db)).toEqual({
			baseEffectiveFrom: '2021-09-01',
			base: { needsBP: 5000, wantsBP: 3000, investBP: 2000 },
			marginal: { needsBP: 2000, wantsBP: 3000, investBP: 5000 }
		});
	});
});

describe('createPromotion', () => {
	it('projects a period at the month start of the effective date', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		const period = activeFor(db, '2022-09-01');
		expect(period?.effectiveFrom).toBe('2022-09-01');
		expect(period?.source).toBe('promotion');
		expect([period?.needsBP, period?.wantsBP, period?.investBP]).toEqual([4299, 3000, 2701]);
	});

	it('leaves months before the promotion on the base weights', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		expect(activeFor(db, '2022-08-01')?.needsBP).toBe(5000);
	});

	it('rejects a bad date, a non-positive raise and a duplicate date', () => {
		expect(() => createPromotion(db, { effectiveDate: '15-09-2022', incrementBP: 3050 })).toThrow(
			/YYYY-MM-DD/
		);
		expect(() => createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 0 })).toThrow(
			/greater than zero/
		);
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		expect(() => createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 1000 })).toThrow();
	});

	it('rejects a duplicate date in a sentence, keeping the SQLite text as the cause', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		const err = thrownBy(() =>
			createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 1000 })
		);

		expect(err.message).toBe('A raise effective 2022-09-15 already exists.');
		// Raw constraint text is demoted to the cause, not lost and not shown.
		expect((err.cause as Error).message).toMatch(/UNIQUE constraint failed/);
	});

	it('rejects a raise dated before the month the base split starts in', () => {
		// One day earlier than the base month — the far side of the boundary.
		const err = thrownBy(() =>
			createPromotion(db, { effectiveDate: '2021-08-31', incrementBP: 5000 })
		);

		expect(err.message).toBe(
			'A raise cannot take effect before the base split starts (2021-09-01).'
		);
		expect(listPromotions(db)).toHaveLength(0);
	});

	it('accepts a raise on the base split date itself', () => {
		expect(createPromotion(db, { effectiveDate: '2021-09-01', incrementBP: 5000 })).toBeGreaterThan(
			0
		);
	});

	it("accepts a raise inside the base split's own month, where it wins the period", () => {
		createPromotion(db, { effectiveDate: '2021-09-20', incrementBP: 5000 });
		const period = activeFor(db, '2021-09-01');

		// Snapped to the base row's own date; precedence hands the period to the
		// promotion, which is why this case is legitimate rather than inverted.
		expect(period?.effectiveFrom).toBe('2021-09-01');
		expect(period?.source).toBe('promotion');
		expect([period?.needsBP, period?.wantsBP, period?.investBP]).toEqual([4000, 3000, 3000]);
	});

	it('measures against the base row date, so a mid-month base cannot be undercut', () => {
		updatePolicy(db, {
			baseEffectiveFrom: '2021-09-15',
			base: { needsBP: 5000, wantsBP: 3000, investBP: 2000 },
			marginal: { needsBP: 2000, wantsBP: 3000, investBP: 5000 }
		});

		// Snaps to 2021-09-01 — inside the base's month, but genuinely before the
		// base row, which would therefore override it from the 15th onward.
		expect(() => createPromotion(db, { effectiveDate: '2021-09-20', incrementBP: 5000 })).toThrow(
			/\(2021-09-15\)/
		);
		expect(createPromotion(db, { effectiveDate: '2021-10-02', incrementBP: 5000 })).toBeGreaterThan(
			0
		);
	});

	it('compounds two promotions inside one year', () => {
		createPromotion(db, { effectiveDate: '2025-03-01', incrementBP: 1000 });
		createPromotion(db, { effectiveDate: '2025-09-01', incrementBP: 2000 });

		// Between them, only the 10% has landed: 0.2 + 0.3/1.1 = 0.47273
		expect(activeFor(db, '2025-06-01')?.needsBP).toBe(4727);
		// After both, 10% then 20% compounds to 32%: 0.2 + 0.3/1.32 = 0.42727
		const after = activeFor(db, '2025-10-01');
		expect([after?.needsBP, after?.wantsBP, after?.investBP]).toEqual([4273, 3000, 2727]);
	});

	it('collapses two promotions in the same month into one period, compounded', () => {
		createPromotion(db, { effectiveDate: '2025-03-05', incrementBP: 1000 });
		createPromotion(db, { effectiveDate: '2025-03-20', incrementBP: 2000 });
		const march = listPeriods(db).filter((p) => p.effectiveFrom === '2025-03-01');
		expect(march).toHaveLength(1);
		expect(march[0].needsBP).toBe(4273);
	});

	it('handles a two-year gap with no promotion', () => {
		createPromotion(db, { effectiveDate: '2023-09-01', incrementBP: 5000 });
		expect(activeFor(db, '2024-06-01')?.needsBP).toBe(activeFor(db, '2025-06-01')?.needsBP);
	});

	it('rolls the insert back when the projection fails', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		const before = snapshot();

		failNextProjection();
		expect(() => createPromotion(db, { effectiveDate: '2023-09-01', incrementBP: 2000 })).toThrow(
			/projection exploded/
		);
		dropProjectionFailure();

		expect(listPromotions(db)).toHaveLength(1);
		expect(snapshot()).toEqual(before);
	});
});

describe('rebuildProjectedPeriods', () => {
	it('is idempotent', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		const before = listPeriods(db).map((p) => `${p.effectiveFrom}:${p.needsBP}:${p.source}`);
		rebuildProjectedPeriods(db);
		rebuildProjectedPeriods(db);
		expect(listPeriods(db).map((p) => `${p.effectiveFrom}:${p.needsBP}:${p.source}`)).toEqual(
			before
		);
	});

	it('never touches manual rows', () => {
		db.prepare(
			`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp)
			 VALUES ('2024-03-01', 3500, 3000, 3500)`
		).run();
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		rebuildProjectedPeriods(db);
		const manual = listPeriods(db).filter((p) => p.source === 'manual');
		expect(manual).toHaveLength(1);
		expect(manual[0].needsBP).toBe(3500);
	});

	it('always emits a base period', () => {
		rebuildProjectedPeriods(db);
		const base = listPeriods(db).filter((p) => p.source === 'base');
		expect(base).toHaveLength(1);
		expect(base[0].effectiveFrom).toBe('2021-09-01');
		expect(base[0].needsBP).toBe(5000);
	});

	/*
	 * The two states hooks.server.ts calls this for, straight after migrate().
	 * Nothing else projects, so before the boot rebuild existed both of these
	 * databases carried a policy that no page could see: /monthly reported no
	 * period covering a month the policy did describe.
	 */
	it('gives a migrated but never-written database the period its policy describes', () => {
		expect(listPeriods(db)).toEqual([]);

		rebuildProjectedPeriods(db);

		expect(listPeriods(db).map((p) => `${p.effectiveFrom}:${p.source}`)).toEqual([
			'2021-09-01:base'
		]);
		expect(activeFor(db, '2026-08-01')?.needsBP).toBe(5000);
	});

	it('adds the base row to an upgraded database without disturbing its own rows', () => {
		// What migration 0003 leaves behind: the pre-existing periods converted to
		// 'manual', and no projection at all.
		createPeriod(db, { effectiveFrom: '2024-08-01', needsBP: 3086, wantsBP: 3000, investBP: 3914 });

		rebuildProjectedPeriods(db);

		expect(listPeriods(db).map((p) => `${p.effectiveFrom}:${p.source}`)).toEqual([
			'2024-08-01:manual',
			'2021-09-01:base'
		]);
		// The manual row still wins its own span; the base row only covers what
		// nothing covered before.
		expect(activeFor(db, '2025-01-01')?.needsBP).toBe(3086);
		expect(activeFor(db, '2022-01-01')?.needsBP).toBe(5000);
	});

	it('rolls back a rebuild that fails part-way, leaving no partial projection', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		const before = snapshot();
		expect(before).toHaveLength(2);

		// Aborts the promotion insert, which lands after the delete and the base
		// row — so a leaked transaction would show up as a half-rebuilt table.
		failNextProjection();
		expect(() => rebuildProjectedPeriods(db)).toThrow(/projection exploded/);
		dropProjectionFailure();

		expect(snapshot()).toEqual(before);
	});

	it('propagates the original failure when SQLite has already rolled back', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		const before = snapshot();

		// RAISE(ROLLBACK) unwinds the transaction itself, so the explicit ROLLBACK
		// that follows finds nothing active — the same position a full or
		// unwritable disk leaves us in. Unguarded, that second failure throws
		// "cannot rollback - no transaction is active" over the real cause.
		autoRollbackNextProjection();
		expect(() => rebuildProjectedPeriods(db)).toThrow(/disk exploded/);
		dropProjectionFailure();

		expect(snapshot()).toEqual(before);
	});
});

describe('deletePromotion', () => {
	it('removes the promotion and reprojects the rest', () => {
		const first = createPromotion(db, { effectiveDate: '2022-09-01', incrementBP: 3050 });
		createPromotion(db, { effectiveDate: '2023-09-01', incrementBP: 9050 });
		expect(activeFor(db, '2024-01-01')?.needsBP).toBe(3207);

		deletePromotion(db, first);
		expect(listPromotions(db)).toHaveLength(1);
		// Only the 90.5% raise remains: 0.2 + 0.3/1.905 = 0.3575
		expect(activeFor(db, '2024-01-01')?.needsBP).toBe(3575);
	});

	it('takes the projected period with it, by cascade', () => {
		const id = createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		expect(listPeriods(db).filter((p) => p.source === 'promotion')).toHaveLength(1);

		// A raw delete, with no reprojection: only ON DELETE CASCADE can clear
		// the period, so this fails the moment foreign keys stop being enforced.
		db.prepare('DELETE FROM promotions WHERE id = ?').run(id);
		expect(listPeriods(db).filter((p) => p.source === 'promotion')).toHaveLength(0);
	});
});

describe('updatePolicy', () => {
	it('reprojects every period when the marginal split changes', () => {
		createPromotion(db, { effectiveDate: '2022-09-01', incrementBP: 3050 });
		updatePolicy(db, {
			baseEffectiveFrom: '2021-09-01',
			base: { needsBP: 5000, wantsBP: 3000, investBP: 2000 },
			marginal: { needsBP: 5000, wantsBP: 3000, investBP: 2000 }
		});
		// Marginal equal to base means the split never moves.
		expect(activeFor(db, '2023-01-01')?.needsBP).toBe(5000);
	});

	it('rejects triples that do not sum to 100%', () => {
		expect(() =>
			updatePolicy(db, {
				baseEffectiveFrom: '2021-09-01',
				base: { needsBP: 5000, wantsBP: 3000, investBP: 1000 },
				marginal: { needsBP: 2000, wantsBP: 3000, investBP: 5000 }
			})
		).toThrow(/Base.*100/);
	});

	it('rejects a marginal triple that does not sum to 100%', () => {
		expect(() =>
			updatePolicy(db, {
				baseEffectiveFrom: '2021-09-01',
				base: { needsBP: 5000, wantsBP: 3000, investBP: 2000 },
				marginal: { needsBP: 2000, wantsBP: 3000, investBP: 4000 }
			})
		).toThrow(/Raise.*100/);
	});

	it('leaves the stored policy alone when a triple is rejected', () => {
		const before = getPolicy(db);
		expect(() =>
			updatePolicy(db, {
				baseEffectiveFrom: '2022-01-01',
				base: { needsBP: 5000, wantsBP: 3000, investBP: 2000 },
				marginal: { needsBP: 2000, wantsBP: 3000, investBP: 4000 }
			})
		).toThrow();
		expect(getPolicy(db)).toEqual(before);
	});

	// The mirror image of createPromotion's guard. That one runs on insert and
	// cannot see this: the ordering is broken afterwards, by a different call.
	it('refuses to move the base past an existing raise, naming the earliest offender', () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });
		createPromotion(db, { effectiveDate: '2023-04-01', incrementBP: 2000 });
		const before = snapshot();

		const err = thrownBy(() => updatePolicy(db, { ...SPLITS, baseEffectiveFrom: '2024-01-01' }));

		// Both raises fall before the proposed base; the earliest is the binding
		// constraint, so it is the one the message names.
		expect(err.message).toBe(
			'The base split cannot start after 2022-09-01: a raise effective 2022-09-15 would fall before it.'
		);
		expect(getPolicy(db).baseEffectiveFrom).toBe('2021-09-01');
		expect(snapshot()).toEqual(before);
	});

	it("accepts a base on the earliest raise's month start, but not a day later", () => {
		createPromotion(db, { effectiveDate: '2022-09-15', incrementBP: 3050 });

		// The raise snaps onto 2022-09-01 and wins there on precedence, exactly
		// as createPromotion allows from the other direction.
		updatePolicy(db, { ...SPLITS, baseEffectiveFrom: '2022-09-01' });
		expect(activeFor(db, '2022-09-01')?.source).toBe('promotion');

		// One day later the base row would override the raise from the 2nd on.
		expect(() => updatePolicy(db, { ...SPLITS, baseEffectiveFrom: '2022-09-02' })).toThrow(
			/2022-09-15/
		);
	});

	it('still accepts a base move when no raise is logged', () => {
		updatePolicy(db, { ...SPLITS, baseEffectiveFrom: '2024-01-01' });
		expect(listPeriods(db).map((p) => `${p.effectiveFrom}:${p.source}`)).toEqual([
			'2024-01-01:base'
		]);
	});
});

describe('listPromotionEffects', () => {
	it('pairs each raise with the split it produced, newest first', () => {
		createPromotion(db, { effectiveDate: '2025-03-01', incrementBP: 1000 });
		createPromotion(db, { effectiveDate: '2025-09-01', incrementBP: 2000 });
		const effects = listPromotionEffects(db);

		expect(effects.map((e) => e.effectiveDate)).toEqual(['2025-09-01', '2025-03-01']);
		// Cumulative: the 10% alone, then the 10% compounded with the 20%.
		expect(effects[1].weights.needsBP).toBe(4727);
		expect(effects[0].weights.needsBP).toBe(4273);
	});

	// Why this is folded rather than read back off budget_periods: the two raises
	// project one shared period, owned by the later of them, so the projection has
	// no row to attribute to the earlier one even though it did take effect.
	it('gives both raises in a shared month their own split', () => {
		createPromotion(db, { effectiveDate: '2025-03-05', incrementBP: 1000 });
		createPromotion(db, { effectiveDate: '2025-03-20', incrementBP: 2000 });

		expect(listPeriods(db).filter((p) => p.effectiveFrom === '2025-03-01')).toHaveLength(1);
		expect(listPromotionEffects(db).map((e) => e.weights.needsBP)).toEqual([4273, 4727]);
	});

	it('is empty with no raise logged', () => {
		expect(listPromotionEffects(db)).toEqual([]);
	});
});

/** The seeded splits, for updates that vary only the base date. */
const SPLITS = {
	base: { needsBP: 5000, wantsBP: 3000, investBP: 2000 },
	marginal: { needsBP: 2000, wantsBP: 3000, investBP: 5000 }
};

/** Every period row, in a shape that compares cleanly across a rollback. */
function snapshot(): string[] {
	return listPeriods(db).map(
		(p) => `${p.id}:${p.effectiveFrom}:${p.needsBP}:${p.wantsBP}:${p.investBP}:${p.source}`
	);
}

/** The error a call threw, for asserting on its message and cause. */
function thrownBy(fn: () => unknown): Error {
	try {
		fn();
	} catch (err) {
		return err as Error;
	}
	throw new Error('expected the call to throw, but it returned');
}

/**
 * Makes the next projection blow up on its promotion insert — i.e. after the
 * delete and the base row have already been written. A temp trigger is the one
 * way to fail mid-rebuild without reaching into the module under test.
 *
 * ABORT undoes only the statement, leaving the transaction open for our own
 * ROLLBACK to unwind.
 */
function failNextProjection(): void {
	raiseOnNextProjection('ABORT', 'projection exploded');
}

/**
 * As above, but ROLLBACK unwinds the whole transaction inside SQLite, so our
 * ROLLBACK arrives to find none active. This is the reachable stand-in for
 * SQLITE_FULL and I/O errors, which do the same thing.
 */
function autoRollbackNextProjection(): void {
	raiseOnNextProjection('ROLLBACK', 'disk exploded');
}

function raiseOnNextProjection(action: 'ABORT' | 'ROLLBACK', message: string): void {
	db.exec(
		`CREATE TEMP TRIGGER fail_projection BEFORE INSERT ON budget_periods
		 WHEN NEW.source = 'promotion'
		 BEGIN SELECT RAISE(${action}, '${message}'); END`
	);
}

function dropProjectionFailure(): void {
	db.exec('DROP TRIGGER temp.fail_projection');
}
