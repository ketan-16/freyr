import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	createSession,
	createUser,
	destroySession,
	sessionUser,
	userCount,
	verifyLogin
} from './auth';
import { migrate, open } from './db';

let db: DatabaseSync;

beforeEach(() => {
	db = open(join(mkdtempSync(join(tmpdir(), 'freyr-auth-')), 'test.db'));
	migrate(db);
});

afterEach(() => {
	db.close();
});

describe('users', () => {
	it('counts and creates', () => {
		expect(userCount(db)).toBe(0);
		const id = createUser(db, 'ketan', 'hunter2hunter2');
		expect(id).toBeGreaterThan(0);
		expect(userCount(db)).toBe(1);
	});

	it('never stores the plain password', () => {
		createUser(db, 'ketan', 'hunter2hunter2');
		const row = db.prepare('SELECT password_hash FROM users').get() as { password_hash: string };
		expect(row.password_hash).not.toContain('hunter2');
		expect(row.password_hash.startsWith('$2')).toBe(true); // bcrypt
	});

	it('verifies correct password, rejects wrong one and unknown user', () => {
		const id = createUser(db, 'ketan', 'hunter2hunter2');
		expect(verifyLogin(db, 'ketan', 'hunter2hunter2')).toBe(id);
		expect(verifyLogin(db, 'ketan', 'wrong')).toBeNull();
		expect(verifyLogin(db, 'nobody', 'hunter2hunter2')).toBeNull();
	});
});

describe('sessions', () => {
	it('round-trips a session and stores only the hash', () => {
		const id = createUser(db, 'ketan', 'hunter2hunter2');
		const token = createSession(db, id);
		expect(token).toMatch(/^[0-9a-f]{64}$/);

		const row = db.prepare('SELECT token_hash FROM sessions').get() as { token_hash: string };
		expect(row.token_hash).not.toBe(token); // sha256 at rest, never the raw token

		expect(sessionUser(db, token)).toEqual({ id, username: 'ketan' });
	});

	it('returns null for unknown or expired tokens', () => {
		const id = createUser(db, 'ketan', 'hunter2hunter2');
		expect(sessionUser(db, 'f'.repeat(64))).toBeNull();

		const token = createSession(db, id);
		db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 day')").run();
		expect(sessionUser(db, token)).toBeNull();
	});

	it('destroySession logs the token out', () => {
		const id = createUser(db, 'ketan', 'hunter2hunter2');
		const token = createSession(db, id);
		destroySession(db, token);
		expect(sessionUser(db, token)).toBeNull();
	});
});
