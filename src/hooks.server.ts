import type { DatabaseSync } from 'node:sqlite';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { sessionUser, userCount } from '$lib/server/auth';
import { startBackupTimer } from '$lib/server/backup';
import { isCrossSiteWrite } from '$lib/server/csrf';
import { migrate, open } from '$lib/server/db';
import { rebuildProjectedPeriods } from '$lib/server/promotions';
import { error, redirect, type Handle } from '@sveltejs/kit';

let db: DatabaseSync | undefined;

function getDb(): DatabaseSync {
	if (!db) {
		db = open(env.FREYR_DB || 'freyr.db');
		migrate(db);
		// budget_periods is a projection of budget_policy plus the promotion log,
		// and until now nothing rebuilt it except a write to one of those. A
		// database that has never had either — freshly created, or upgraded, since
		// migration 0003 converts the old rows to 'manual' and projects nothing —
		// therefore carried a policy the rest of the app could not see, and
		// /monthly reported no period covering a month the policy did describe.
		// Idempotent: it rewrites only the rows it owns and never a manual one.
		rebuildProjectedPeriods(db);
		startBackupTimer(db, env.FREYR_BACKUPS || 'backups');
	}
	return db;
}

const PUBLIC_PATHS = new Set(['/login', '/setup']);
/** Reachable whether or not you are signed in — neither redirect applies. */
const ALWAYS_PATHS = new Set(['/theme']);

/** Stamp the resolved theme onto <html> during SSR so the first paint is right. */
function withTheme(theme: 'light' | 'dark' | null) {
	return {
		transformPageChunk: ({ html }: { html: string }) =>
			html.replace('%freyr.theme%', theme ? `data-theme="${theme}"` : '')
	};
}

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event, withTheme(null));

	if (isCrossSiteWrite(event.request)) {
		error(403, 'Cross-site form submissions are forbidden');
	}

	const database = getDb();
	event.locals.db = database;

	const token = event.cookies.get('freyr_session');
	event.locals.user = token ? sessionUser(database, token) : null;

	// No cookie means "follow the OS": we emit no attribute and the
	// prefers-color-scheme block in app.css decides.
	const cookie = event.cookies.get('freyr_theme');
	event.locals.theme = cookie === 'dark' || cookie === 'light' ? cookie : null;

	const path = event.url.pathname;
	if (!ALWAYS_PATHS.has(path)) {
		if (!event.locals.user && !PUBLIC_PATHS.has(path)) {
			redirect(303, userCount(database) === 0 ? '/setup' : '/login');
		}
		if (event.locals.user && PUBLIC_PATHS.has(path)) {
			redirect(303, '/');
		}
	}

	return resolve(event, withTheme(event.locals.theme));
};
