import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrate, open } from './index';

function tempDbPath(): string {
	return join(mkdtempSync(join(tmpdir(), 'freyr-test-')), 'test.db');
}

describe('open', () => {
	it('enables foreign keys, WAL and busy timeout', () => {
		const db = open(tempDbPath());
		try {
			expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
			expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
			expect(db.prepare('PRAGMA busy_timeout').get()).toEqual({ timeout: 5000 });
		} finally {
			db.close();
		}
	});
});

describe('migrate', () => {
	it('applies migrations and is idempotent', () => {
		const db = open(tempDbPath());
		try {
			migrate(db);
			migrate(db); // second run must be a no-op, not an error

			const users = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
			expect(users.n).toBe(0);

			const versions = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as {
				n: number;
			};
			expect(versions.n).toBeGreaterThan(0);
		} finally {
			db.close();
		}
	});
});
