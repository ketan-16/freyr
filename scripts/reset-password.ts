/**
 * Reset a Freyr account password.
 * Usage: npm run passwd -- <username> [new password] [--db freyr.db]
 *
 * Passwords are bcrypt hashes, so a forgotten one cannot be recovered — only
 * replaced. Omit the new password and a strong one is generated and printed.
 * Existing sessions for that user are destroyed, so any live cookie stops
 * working the moment the password changes.
 */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { migrate, open } from '../src/lib/server/db';

const BCRYPT_COST = 12;

const args = process.argv.slice(2);
const dbFlag = args.indexOf('--db');
const dbPath = dbFlag >= 0 ? args[dbFlag + 1] : process.env.FREYR_DB || 'freyr.db';
const rest = args.filter((_, i) => dbFlag < 0 || (i !== dbFlag && i !== dbFlag + 1));

const username = rest[0];
const supplied = rest[1];

const db = open(dbPath);
migrate(db);

const users = db.prepare('SELECT id, username FROM users ORDER BY id').all() as {
	id: number;
	username: string;
}[];

if (!username) {
	console.error('usage: npm run passwd -- <username> [new password] [--db freyr.db]');
	console.error(
		users.length
			? `\naccounts in ${dbPath}:\n${users.map((u) => `  ${u.username}`).join('\n')}`
			: `\nno accounts in ${dbPath} — start the app and it will redirect to /setup`
	);
	process.exit(1);
}

const user = users.find((u) => u.username === username);
if (!user) {
	console.error(`no such user: ${username}`);
	console.error(`accounts in ${dbPath}: ${users.map((u) => u.username).join(', ') || '(none)'}`);
	process.exit(1);
}

if (supplied !== undefined && supplied.length < 8) {
	console.error('password must be at least 8 characters (same rule as /setup)');
	process.exit(1);
}

// base64url avoids shell-quoting pain and characters that are ambiguous to type.
const password = supplied ?? randomBytes(15).toString('base64url');

db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
	bcrypt.hashSync(password, BCRYPT_COST),
	user.id
);
const dropped = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

console.log(`password reset for "${user.username}" in ${dbPath}`);
if (!supplied) console.log(`\n  new password:  ${password}\n`);
console.log(`${dropped.changes} existing session(s) invalidated — log in again.`);

db.close();
