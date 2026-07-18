import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

const KEEP = 30;
const CHECK_EVERY_MS = 60 * 60 * 1000; // hourly; backup() itself dedupes by date

/**
 * Writes a consistent snapshot to dir/freyr-<today>.db via VACUUM INTO, unless one
 * already exists for the day. Prunes to the newest 30 snapshots. Returns the path
 * written, or null when today's snapshot already existed.
 */
export function backup(db: DatabaseSync, dir: string, today: string): string | null {
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `freyr-${today}.db`);
	if (existsSync(path)) return null;

	db.prepare('VACUUM INTO ?').run(path);
	prune(dir);
	return path;
}

function prune(dir: string): void {
	const snapshots = readdirSync(dir)
		.filter((f) => /^freyr-\d{4}-\d{2}-\d{2}\.db$/.test(f))
		.sort(); // ISO dates in the name sort chronologically
	for (const stale of snapshots.slice(0, Math.max(0, snapshots.length - KEEP))) {
		unlinkSync(join(dir, stale));
	}
}

/** Starts the hourly backup check. Returns a stop function. */
export function startBackupTimer(db: DatabaseSync, dir: string): () => void {
	const run = () => {
		try {
			const path = backup(db, dir, new Date().toISOString().slice(0, 10));
			if (path) console.log(`freyr: backup written to ${path}`);
		} catch (err) {
			console.error('freyr: backup failed:', err);
		}
	};
	run();
	const timer = setInterval(run, CHECK_EVERY_MS);
	return () => clearInterval(timer);
}
