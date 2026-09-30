/**
 * Offline support — the parts the service worker, the page and the server
 * share: what a queued write is, how kept page data is keyed and merged, and
 * how the answer to a replayed write is judged. Pure functions and types, no
 * browser or worker APIs, so they are tested like the rest of the domain.
 * The worker itself is src/service-worker.ts; see ARCHITECTURE.md § Offline.
 */

import { formatMoney, parseMoney } from './money';

/**
 * Every attempt at one write carries the same key, so a replay of a write
 * whose answer was lost is recognised and answered, not applied twice
 * ($lib/server/replay).
 */
export const KEY_HEADER = 'x-freyr-key';
/** The server's answer while the first attempt with that key is still running. */
export const BUSY_HEADER = 'x-freyr-busy';

/** Request headers a queued write keeps, so its replay is the same request. */
export const KEPT_HEADERS = ['content-type', 'accept', 'x-sveltekit-action'];

/** Signing in or out needs the server now; it never waits in the queue. */
const NEVER_QUEUED = new Set(['/login', '/setup', '/logout']);

/**
 * Whether a same-origin, script-sent POST may wait for the connection: every
 * form action (the add sheet, an edit, settings) and the theme setting.
 */
export function queueable(path: string, action: boolean): boolean {
	return !NEVER_QUEUED.has(path) && (action || path === '/theme');
}

/** A write waiting in the worker's IndexedDB queue. Ascending `id` is the order it was made in. */
export interface QueuedWrite {
	id?: number;
	key: string;
	url: string;
	headers: [string, string][];
	body: string;
	/** A SvelteKit form action, which answers with JSON; else a plain endpoint (/theme). */
	action: boolean;
	at: number;
	/** Why the server refused it, once it has. It then waits for Retry or Discard. */
	error?: string;
}

/** A queued write as the page shows it. */
export interface SyncItem {
	id: number;
	/** Path and query, e.g. `/ledger?/create`. */
	path: string;
	fields: Record<string, string>;
	at: number;
	error?: string;
}

export interface SyncStatus {
	/** The last request reached Freyr (false: offline, or the box is down). */
	online: boolean;
	syncing: boolean;
	/** Replay stopped at a sign-in: the session ended while writes waited. */
	needsAuth: boolean;
	pending: SyncItem[];
	failed: SyncItem[];
}

/** Page → worker. */
export type ToWorker =
	| { type: 'hello' }
	| { type: 'sync' }
	| { type: 'hidden' }
	| { type: 'retry'; id: number }
	| { type: 'discard'; id: number };

/** Worker → page. `version` is the worker's release, for a page to tell whether it is behind. */
export type FromWorker =
	{ type: 'status'; status: SyncStatus; version: string } | { type: 'synced'; count: number };

/** A queued write, shown to the page: its path and, for a form post, the fields it sends. */
export function toSyncItem(write: QueuedWrite): SyncItem {
	const url = new URL(write.url);
	const type = write.headers.find(([name]) => name === 'content-type')?.[1] ?? '';
	const fields = type.startsWith('application/x-www-form-urlencoded')
		? Object.fromEntries(new URLSearchParams(write.body))
		: {};
	return {
		id: write.id ?? 0,
		path: url.pathname + url.search,
		fields,
		at: write.at,
		error: write.error
	};
}

/**
 * The cache key for a `__data.json` request. Which of the page's nodes the
 * router asked for is not part of it — one kept copy answers them all — and
 * neither is the trailing-slash flag the router adds for `/`.
 */
export function dataKey(url: URL): string {
	const key = new URL(url);
	key.searchParams.delete('x-sveltekit-invalidated');
	key.searchParams.delete('x-sveltekit-trailing-slash');
	return key.href;
}

type DataNode = { type: string } | null;

function parseData(text: string | null): DataNode[] | null {
	if (!text) return null;
	try {
		const parsed = JSON.parse(text);
		return parsed?.type === 'data' && Array.isArray(parsed.nodes) ? parsed.nodes : null;
	} catch {
		return null;
	}
}

/**
 * Fold a fresh `__data.json` answer into the copy already kept. The router
 * asks only for the nodes whose data changed and is answered `skip` for the
 * rest, so the kept copy takes the last real answer for each node — that way
 * it can stand in for a request that asks for everything. Null when the
 * answer is not worth keeping: a redirect, an error, or a stream.
 */
export function mergeData(fresh: string, kept: string | null): string | null {
	const nodes = parseData(fresh);
	if (!nodes || nodes.some((n) => n?.type === 'error')) return null;
	const before = parseData(kept);
	const merged = nodes.map((n, i) => (n?.type === 'skip' ? (before?.[i] ?? n) : n));
	return JSON.stringify({ type: 'data', nodes: merged });
}

/**
 * The root layout's node out of a data answer. When a page was never kept,
 * the router falls back to the root error page and asks for this node alone;
 * answering it keeps the app's own chrome around the offline notice.
 */
export function layoutData(text: string): string | null {
	const first = parseData(text)?.[0];
	return first?.type === 'data' ? JSON.stringify({ type: 'data', nodes: [first] }) : null;
}

/**
 * The `error` a failed action returned — every action here fails with one —
 * out of SvelteKit's devalue encoding (`[{"error":1,…},"the message",…]`),
 * without shipping devalue to the worker.
 */
export function failureMessage(data: unknown): string | null {
	if (typeof data !== 'string') return null;
	try {
		const flat = JSON.parse(data);
		const at = Array.isArray(flat) ? flat[0]?.error : undefined;
		return typeof at === 'number' && typeof flat[at] === 'string' ? flat[at] : null;
	} catch {
		return null;
	}
}

/** Where a write goes when it needs a signed-in session and there is none. */
const SIGN_IN = new Set(['/login', '/setup']);

/**
 * A form action's redirect to sign in: the session ended and nothing was
 * saved — though to `enhance` it looks exactly like a save that redirected.
 */
export function signsIn(location: string): boolean {
	return SIGN_IN.has(new URL(location, 'http://x').pathname);
}

export type Verdict =
	{ kind: 'done' } | { kind: 'retry'; signIn: boolean } | { kind: 'failed'; message: string };

/**
 * What the answer to a replayed write means. `retry` keeps it at the head of
 * the queue — Freyr is unreachable, still busy with it, or wants a sign-in
 * first (a redirect there looks exactly like success, so it is told apart by
 * where it points). `failed` parks it with the server's reason. `done` drops it.
 */
export function judge(
	write: { action: boolean },
	answer: { status: number; opaqueRedirect: boolean; busy: boolean; body: string }
): Verdict {
	const retry = (signIn = false): Verdict => ({ kind: 'retry', signIn });
	const failed = (message: string): Verdict => ({ kind: 'failed', message });

	if (answer.busy || (answer.status >= 502 && answer.status <= 504)) return retry();
	if (answer.opaqueRedirect) return write.action ? retry(true) : { kind: 'done' };
	if (!write.action) {
		return answer.status < 400 ? { kind: 'done' } : failed(`Freyr answered ${answer.status}.`);
	}

	let result: { type?: string; location?: string; data?: unknown; error?: { message?: string } };
	try {
		result = JSON.parse(answer.body);
	} catch {
		return failed(`Freyr answered ${answer.status}.`);
	}
	switch (result?.type) {
		case 'success':
			return { kind: 'done' };
		case 'redirect':
			return signsIn(result.location ?? '/') ? retry(true) : { kind: 'done' };
		case 'failure':
			return failed(failureMessage(result.data) ?? 'Freyr refused this change.');
		case 'error':
			return failed(result.error?.message ?? 'Freyr could not save this change.');
		default:
			return failed(`Freyr answered ${answer.status}.`);
	}
}

/** The typed amount as money, or as typed when it does not parse. */
function amount(raw: string | undefined): string {
	try {
		return formatMoney(parseMoney(raw ?? ''));
	} catch {
		return raw ? `₹${raw}` : '';
	}
}

/**
 * A queued write in a few words, for the sync panel: "Add ₹120 · Food",
 * "Rename a category to Rent". `category` names a posted category id.
 */
export function describeWrite(
	item: Pick<SyncItem, 'path' | 'fields'>,
	category: (id: string) => string | undefined
): string {
	const url = new URL(item.path, 'http://x');
	const name = url.search.startsWith('?/') ? url.search.slice(2) : 'default';
	const f = item.fields;
	const txn = (verb: string) =>
		[`${verb} ${amount(f.amount)}`, category(f.category) ?? f.note].filter(Boolean).join(' · ');

	if (url.pathname === '/theme') {
		const to = f.to === 'system' || f.to === 'dark' ? f.to : 'light';
		return `Theme: ${to[0].toUpperCase()}${to.slice(1)}`;
	}
	if (url.pathname === '/' || url.pathname === '/ledger') {
		if (name === 'create') return txn('Add');
		if (name === 'delete') return 'Delete a transaction';
	}
	if (url.pathname.startsWith('/ledger/')) {
		if (name === 'update') return txn('Edit');
		if (name === 'delete') return 'Delete a transaction';
	}
	if (url.pathname === '/settings/categories') {
		if (name === 'add') return `Add the category ${f.name ?? ''}`.trim();
		if (name === 'rename') return `Rename a category to ${f.name ?? ''}`.trim();
		if (name === 'archive') return f.archived === '1' ? 'Archive a category' : 'Restore a category';
		if (name === 'delete') return 'Delete a category';
	}
	if (url.pathname === '/settings/budget') {
		if (name === 'savePolicy') return 'Save the split policy';
		if (name === 'addPromotion') return 'Add a raise';
		if (name === 'deletePromotion') return 'Remove a raise';
		if (name === 'addPeriod') return 'Add a budget period';
	}
	return `A change on ${url.pathname}`;
}
