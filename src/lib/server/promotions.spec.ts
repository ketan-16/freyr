import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { activeFor, listPeriods } from './budgets';
import {
	createPromotion,
	deletePromotion,
	getPolicy,
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
});

/** Every period row, in a shape that compares cleanly across a rollback. */
function snapshot(): string[] {
	return listPeriods(db).map(
		(p) => `${p.id}:${p.effectiveFrom}:${p.needsBP}:${p.wantsBP}:${p.investBP}:${p.source}`
	);
}

/**
 * Makes the next projection blow up on its promotion insert — i.e. after the
 * delete and the base row have already been written. A temp trigger is the one
 * way to fail mid-rebuild without reaching into the module under test.
 */
function failNextProjection(): void {
	db.exec(
		`CREATE TEMP TRIGGER fail_projection BEFORE INSERT ON budget_periods
		 WHEN NEW.source = 'promotion'
		 BEGIN SELECT RAISE(ABORT, 'projection exploded'); END`
	);
}

function dropProjectionFailure(): void {
	db.exec('DROP TRIGGER temp.fail_projection');
}
