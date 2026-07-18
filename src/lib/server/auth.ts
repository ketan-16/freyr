import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;
const SESSION_DAYS = 90;

export interface SessionUser {
	id: number;
	username: string;
}

export function userCount(db: DatabaseSync): number {
	const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
	return row.n;
}

export function createUser(db: DatabaseSync, username: string, password: string): number {
	const hash = bcrypt.hashSync(password, BCRYPT_COST);
	const result = db
		.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
		.run(username, hash);
	return Number(result.lastInsertRowid);
}

/** Returns the user id on success, null on unknown user or wrong password. */
export function verifyLogin(db: DatabaseSync, username: string, password: string): number | null {
	const row = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username) as
		{ id: number; password_hash: string } | undefined;
	if (!row) return null;
	return bcrypt.compareSync(password, row.password_hash) ? row.id : null;
}

/** Creates a session and returns the raw token; only its sha256 is stored. */
export function createSession(db: DatabaseSync, userId: number): string {
	const token = randomBytes(32).toString('hex');
	db.prepare(
		`INSERT INTO sessions (token_hash, user_id, expires_at)
		 VALUES (?, ?, datetime('now', ?))`
	).run(hashToken(token), userId, `+${SESSION_DAYS} days`);
	return token;
}

/** Resolves a raw cookie token to its user, or null if unknown/expired. */
export function sessionUser(db: DatabaseSync, token: string): SessionUser | null {
	const row = db
		.prepare(
			`SELECT u.id, u.username FROM sessions s
			 JOIN users u ON u.id = s.user_id
			 WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
		)
		.get(hashToken(token)) as SessionUser | undefined;
	return row ?? null;
}

export function destroySession(db: DatabaseSync, token: string): void {
	db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}
