import type { DatabaseSync } from 'node:sqlite';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { sessionUser, userCount } from '$lib/server/auth';
import { startBackupTimer } from '$lib/server/backup';
import { isCrossSiteWrite } from '$lib/server/csrf';
import { migrate, open } from '$lib/server/db';
import { error, redirect, type Handle } from '@sveltejs/kit';

let db: DatabaseSync | undefined;

function getDb(): DatabaseSync {
	if (!db) {
		db = open(env.FREYR_DB || 'freyr.db');
		migrate(db);
		startBackupTimer(db, env.FREYR_BACKUPS || 'backups');
	}
	return db;
}

const PUBLIC_PATHS = new Set(['/login', '/setup']);

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	if (isCrossSiteWrite(event.request)) {
		error(403, 'Cross-site form submissions are forbidden');
	}

	const database = getDb();
	event.locals.db = database;

	const token = event.cookies.get('freyr_session');
	event.locals.user = token ? sessionUser(database, token) : null;

	const path = event.url.pathname;
	if (!event.locals.user && !PUBLIC_PATHS.has(path)) {
		redirect(303, userCount(database) === 0 ? '/setup' : '/login');
	}
	if (event.locals.user && PUBLIC_PATHS.has(path)) {
		redirect(303, '/');
	}

	return resolve(event);
};
