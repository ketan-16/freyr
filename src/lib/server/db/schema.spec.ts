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
