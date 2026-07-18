import { DatabaseSync } from 'node:sqlite';

/**
 * Migration files are bundled into the build via Vite's raw glob import,
 * so the runtime never needs to locate .sql files on disk.
 */
const migrationFiles = import.meta.glob('./migrations/*.sql', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

/** Opens (creating if needed) the SQLite file with the required pragmas. */
export function open(path: string): DatabaseSync {
	const db = new DatabaseSync(path);
	db.exec('PRAGMA journal_mode = WAL');
	db.exec('PRAGMA busy_timeout = 5000');
	db.exec('PRAGMA foreign_keys = ON');
	return db;
}

/** Applies bundled migrations in filename order; each runs once, inside a transaction. */
export function migrate(db: DatabaseSync): void {
	db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version    INTEGER PRIMARY KEY,
		applied_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`);

	const applied = new Set(
		(db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
			(r) => r.version
		)
	);

	const migrations = Object.entries(migrationFiles)
		.map(([path, sql]) => {
			const name = path.split('/').at(-1)!;
			const version = Number(name.split('_')[0]);
			if (!Number.isInteger(version)) throw new Error(`bad migration filename: ${name}`);
			return { version, name, sql };
		})
		.sort((a, b) => a.version - b.version);

	for (const m of migrations) {
		if (applied.has(m.version)) continue;
		db.exec('BEGIN');
		try {
			db.exec(m.sql);
			db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version);
			db.exec('COMMIT');
		} catch (err) {
			db.exec('ROLLBACK');
			throw new Error(`migration ${m.name} failed: ${err instanceof Error ? err.message : err}`);
		}
	}
}
