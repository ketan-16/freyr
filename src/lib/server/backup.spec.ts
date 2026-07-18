import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backup } from './backup';
import { migrate, open } from './db';

let db: DatabaseSync;
let dir: string;

beforeEach(() => {
	const base = mkdtempSync(join(tmpdir(), 'freyr-backup-'));
	db = open(join(base, 'live.db'));
	migrate(db);
	dir = join(base, 'backups');
});

afterEach(() => {
	db.close();
});

describe('backup', () => {
	it('writes a valid snapshot named by date', () => {
		const path = backup(db, dir, '2026-07-18');
		expect(path).toBe(join(dir, 'freyr-2026-07-18.db'));

		const snapshot = open(path!);
		try {
			const n = snapshot.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as {
				n: number;
			};
			expect(n.n).toBeGreaterThan(0);
		} finally {
			snapshot.close();
		}
	});

	it('is a no-op when today’s snapshot already exists', () => {
		expect(backup(db, dir, '2026-07-18')).not.toBeNull();
		expect(backup(db, dir, '2026-07-18')).toBeNull();
	});

	it('prunes to the newest 30 snapshots', () => {
		backup(db, dir, '2026-07-18');
		for (let i = 1; i <= 31; i++) {
			const day = String(i).padStart(2, '0');
			writeFileSync(join(dir, `freyr-2026-06-${day}.db`), 'stale');
		}

		backup(db, dir, '2026-07-19');

		const files = readdirSync(dir).sort();
		expect(files).toHaveLength(30);
		expect(files).not.toContain('freyr-2026-06-01.db'); // oldest gone
		expect(files).toContain('freyr-2026-07-19.db');
	});
});
