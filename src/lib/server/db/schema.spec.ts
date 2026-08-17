import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate, open } from './index';

let db: DatabaseSync;

beforeEach(() => {
	db = open(join(mkdtempSync(join(tmpdir(), 'freyr-schema-')), 'test.db'));
	migrate(db);
});

afterEach(() => {
	db.close();
});

function insertTxn(cols: Record<string, unknown>): void {
	const keys = Object.keys(cols);
	db.prepare(
		`INSERT INTO transactions (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
	).run(...(Object.values(cols) as never[]));
}

describe('transactions CHECK constraints', () => {
	it('accepts a valid income and a valid outflow', () => {
		expect(() => {
			insertTxn({
				date: '2026-07-01',
				amount_paise: 100,
				direction: 'income',
				income_source: 'job'
			});
			insertTxn({ date: '2026-07-02', amount_paise: 100, direction: 'outflow', bucket: 'needs' });
		}).not.toThrow();
	});

	it('rejects a zero or negative amount', () => {
		expect(() =>
			insertTxn({ date: '2026-07-01', amount_paise: 0, direction: 'outflow', bucket: 'needs' })
		).toThrow();
	});

	it('rejects income with a bucket, and income without a source', () => {
		expect(() =>
			insertTxn({
				date: '2026-07-01',
				amount_paise: 100,
				direction: 'income',
				income_source: 'job',
				bucket: 'needs'
			})
		).toThrow();
		expect(() =>
			insertTxn({ date: '2026-07-01', amount_paise: 100, direction: 'income' })
		).toThrow();
	});

	it('rejects an outflow without a bucket, and an outflow with a source', () => {
		expect(() =>
			insertTxn({ date: '2026-07-01', amount_paise: 100, direction: 'outflow' })
		).toThrow();
		expect(() =>
			insertTxn({
				date: '2026-07-01',
				amount_paise: 100,
				direction: 'outflow',
				bucket: 'wants',
				income_source: 'job'
			})
		).toThrow();
	});

	it('requires goal and location together', () => {
		db.prepare("INSERT INTO goals (name, kind) VALUES ('Car', 'goal')").run();
		db.prepare("INSERT INTO locations (name) VALUES ('Bank')").run();

		expect(() =>
			insertTxn({
				date: '2026-07-01',
				amount_paise: 100,
				direction: 'outflow',
				bucket: 'investments',
				goal_id: 1
			})
		).toThrow();
		expect(() =>
			insertTxn({
				date: '2026-07-01',
				amount_paise: 100,
				direction: 'outflow',
				bucket: 'investments',
				location_id: 1
			})
		).toThrow();

		insertTxn({
			date: '2026-07-01',
			amount_paise: 100,
			direction: 'outflow',
			bucket: 'investments',
			goal_id: 1,
			location_id: 1
		});
	});

	it('enforces foreign keys', () => {
		expect(() =>
			insertTxn({
				date: '2026-07-01',
				amount_paise: 100,
				direction: 'outflow',
				bucket: 'investments',
				goal_id: 999,
				location_id: 999
			})
		).toThrow();
	});
});

describe('0004 categories schema', () => {
	const insert = (scope: string, name: string) =>
		db.prepare('INSERT INTO categories (scope, name) VALUES (?, ?)').run(scope, name);

	it('scopes the name, so one word can serve two buckets', () => {
		insert('needs', 'Travel');
		insert('wants', 'Travel');
		expect(() => insert('wants', 'Travel')).toThrow();
	});

	it('rejects a scope outside the bucket and income-source enums', () => {
		expect(() => insert('rent', 'Flat')).toThrow();
	});

	it('rejects a blank name', () => {
		expect(() => insert('needs', '   ')).toThrow();
	});

	it('defaults to not archived, and only takes 0 or 1', () => {
		insert('needs', 'Grocery');
		const row = db.prepare("SELECT archived FROM categories WHERE name = 'Grocery'").get() as {
			archived: number;
		};
		expect(row.archived).toBe(0);
		expect(() =>
			db.prepare("UPDATE categories SET archived = 2 WHERE name = 'Grocery'").run()
		).toThrow();
	});

	it('clears the label off a transaction rather than blocking the delete', () => {
		insert('wants', 'Eating out');
		insertTxn({
			date: '2026-07-01',
			amount_paise: 100,
			direction: 'outflow',
			bucket: 'wants',
			category_id: 1
		});
		// The domain refuses this; the schema's job is only to leave no dangling
		// reference behind if it ever happens.
		db.prepare('DELETE FROM categories WHERE id = 1').run();
		const row = db.prepare('SELECT category_id FROM transactions').get() as {
			category_id: number | null;
		};
		expect(row.category_id).toBeNull();
	});
});

describe('budget_periods CHECK constraints', () => {
	it('accepts basis points summing to 10000, rejects others', () => {
		db.prepare(
			`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp)
			 VALUES ('2025-01-01', 2720, 3000, 4280)`
		).run();
		expect(() =>
			db
				.prepare(
					`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp)
					 VALUES ('2025-02-01', 2700, 3000, 4000)`
				)
				.run()
		).toThrow();
	});
});

describe('emergency_fund_plans single row', () => {
	it('only allows id = 1', () => {
		db.prepare('INSERT INTO emergency_fund_plans (id, planned_months) VALUES (1, 6)').run();
		expect(() =>
			db.prepare('INSERT INTO emergency_fund_plans (id, planned_months) VALUES (2, 6)').run()
		).toThrow();
	});
});

describe('0003 promotions schema', () => {
	it('seeds exactly one policy row with the 50/30/20 base and 20/30/50 margin', () => {
		const row = db
			.prepare(
				`SELECT base_effective_from, base_needs_bp, base_wants_bp, base_invest_bp,
				        marg_needs_bp, marg_wants_bp, marg_invest_bp
				 FROM budget_policy`
			)
			.all() as Record<string, unknown>[];
		expect(row).toHaveLength(1);
		expect(row[0]).toMatchObject({
			base_effective_from: '2021-09-01',
			base_needs_bp: 5000,
			base_wants_bp: 3000,
			base_invest_bp: 2000,
			marg_needs_bp: 2000,
			marg_wants_bp: 3000,
			marg_invest_bp: 5000
		});
	});

	it('refuses a second policy row', () => {
		expect(() =>
			db
				.prepare(
					`INSERT INTO budget_policy (id, base_effective_from,
					   base_needs_bp, base_wants_bp, base_invest_bp,
					   marg_needs_bp, marg_wants_bp, marg_invest_bp)
					 VALUES (2, '2022-01-01', 5000, 3000, 2000, 2000, 3000, 5000)`
				)
				.run()
		).toThrow();
	});

	it('refuses policy triples that do not sum to 100%', () => {
		expect(() =>
			db.prepare('UPDATE budget_policy SET base_needs_bp = 4000 WHERE id = 1').run()
		).toThrow();
	});

	it('refuses a non-positive or duplicate promotion', () => {
		db.prepare('INSERT INTO promotions (effective_date, increment_bp) VALUES (?, ?)').run(
			'2025-09-15',
			2000
		);
		expect(() =>
			db
				.prepare('INSERT INTO promotions (effective_date, increment_bp) VALUES (?, ?)')
				.run('2026-01-01', 0)
		).toThrow();
		expect(() =>
			db
				.prepare('INSERT INTO promotions (effective_date, increment_bp) VALUES (?, ?)')
				.run('2025-09-15', 1000)
		).toThrow();
	});

	it('defaults budget_periods.source to manual and allows one row per source per date', () => {
		db.prepare(
			`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp)
			 VALUES ('2025-01-01', 2720, 3000, 4280)`
		).run();
		const source = db
			.prepare(`SELECT source FROM budget_periods WHERE effective_from = '2025-01-01'`)
			.get() as { source: string };
		expect(source.source).toBe('manual');

		// same date, different source — allowed
		db.prepare(
			`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp, source)
			 VALUES ('2025-01-01', 5000, 3000, 2000, 'base')`
		).run();

		// same date, same source — rejected
		expect(() =>
			db
				.prepare(
					`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp, source)
					 VALUES ('2025-01-01', 5000, 3000, 2000, 'base')`
				)
				.run()
		).toThrow();
	});

	it('ties promotion_id to source = promotion', () => {
		expect(() =>
			db
				.prepare(
					`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp, source)
					 VALUES ('2027-01-01', 5000, 3000, 2000, 'promotion')`
				)
				.run()
		).toThrow();
	});

	it('preserves pre-existing periods as manual rows across the 0003 upgrade', () => {
		const fresh = open(join(mkdtempSync(join(tmpdir(), 'freyr-upgrade-')), 'test.db'));
		try {
			migrate(fresh, 2); // the schema as it stood before this feature
			fresh
				.prepare(
					`INSERT INTO budget_periods (effective_from, needs_bp, wants_bp, invest_bp)
					 VALUES ('2024-08-01', 3086, 3000, 3914)`
				)
				.run();

			migrate(fresh); // now apply 0003

			const rows = fresh
				.prepare('SELECT effective_from, needs_bp, wants_bp, invest_bp, source FROM budget_periods')
				.all() as Record<string, unknown>[];
			expect(rows).toEqual([
				{
					effective_from: '2024-08-01',
					needs_bp: 3086,
					wants_bp: 3000,
					invest_bp: 3914,
					source: 'manual'
				}
			]);
		} finally {
			fresh.close();
		}
	});
});
