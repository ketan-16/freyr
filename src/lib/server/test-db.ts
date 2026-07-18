import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { migrate, open } from './db';

/** Test-only: a migrated SQLite database in a fresh temp directory. */
export function testDb(): DatabaseSync {
	const db = open(join(mkdtempSync(join(tmpdir(), 'freyr-test-')), 'test.db'));
	migrate(db);
	return db;
}
