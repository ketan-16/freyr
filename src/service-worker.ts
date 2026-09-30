/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Freyr, offline. Online first: a page and its data come from the network
 * whenever it answers, and what it answered is kept. When it does not — no
 * signal, or the box is down — the kept copy is shown, and writes (every form
 * action, and the theme) wait in IndexedDB, in the order they were made,
 * until Freyr can take them. SvelteKit registers this file on every page.
 * See ARCHITECTURE.md § Offline.
 */

import { build, files, version } from '$service-worker';
import {
	BUSY_HEADER,
	dataKey,
	judge,
	KEPT_HEADERS,
	KEY_HEADER,
	layoutData,
	mergeData,
	queueable,
	toSyncItem,
	type FromWorker,
	type QueuedWrite,
	type SyncStatus,
	type ToWorker
} from '$lib/offline';

const sw = globalThis.self as unknown as ServiceWorkerGlobalScope;

/** The app's own files. Their names carry a hash, so a kept copy is always the right one. */
const ASSETS = `assets-${version}`;
/** Pages and their data, as last seen. Per release: a new one starts clean. */
const PAGES = `pages-${version}`;
/** version.json must always ask the server: it is how a page learns of a new release. */
const SHELL = [...build, ...files].filter((path) => !path.endsWith('/version.json'));
const SHELL_PATHS = new Set(SHELL);

/** Every screen in the navigation — kept for offline without having to be visited first. */
const SCREENS = [
	'/',
	'/ledger',
	'/monthly',
	'/yearly',
	'/settings',
	'/settings/budget',
	'/settings/categories'
];
/** Pages that are the same for everyone, and useless offline. */
const PUBLIC = new Set(['/login', '/setup']);
/** How long a page may take before the kept copy is shown in its place. */
const PATIENCE = 4000;
/** The most pages kept; the least recently refreshed go first. */
const KEEP = 80;

const origin = sw.location.origin;
const LAYOUT = `${origin}/__freyr/layout.json`;
const WARMED = `${origin}/__freyr/warmed`;

/* ---- Lifecycle ---------------------------------------------------------- */

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			await (await caches.open(ASSETS)).addAll(SHELL);
			// A new release takes over at once. An open page is still running the
			// old one's code, so it reloads on its next navigation (+layout.svelte).
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			// The release before this one keeps its files, so a page still running
			// it can load the rest of its own code offline until it reloads.
			const previous = keys
				.filter((key) => key.startsWith('assets-') && key !== ASSETS)
				.sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
				.at(-1);
			for (const key of keys) {
				if (key !== ASSETS && key !== PAGES && key !== previous) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

/* ---- Reads: network first, the kept copy when it fails --------------------- */

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (url.origin !== origin) return;

	if (request.method === 'POST') {
		if (request.mode === 'navigate') event.respondWith(post(request, url));
		else if (queueable(url.pathname, request.headers.get('x-sveltekit-action') === 'true'))
			event.respondWith(write(request));
		return;
	}
	if (request.method !== 'GET') return;

	if (SHELL_PATHS.has(url.pathname) || url.pathname.startsWith('/_app/immutable/')) {
		// Any release's copy: an older page asks for its own files by their own names.
		event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
	} else if (url.pathname.endsWith('/__data.json')) {
		const key = dataKey(url);
		event.respondWith(
			fresh(
				event,
				key,
				(res) => keepData(key, res),
				() => missingData(url)
			)
		);
	} else if (request.mode === 'navigate') {
		const key = url.origin + url.pathname + url.search;
		event.respondWith(
			fresh(
				event,
				key,
				(res) => keepPage(key, url, res),
				async () => offline()
			)
		);
	}
});

/**
 * Network first. The network's answer if it comes within PATIENCE; after
 * that, or when it fails, the kept copy; with neither, `missing`. A late
 * answer is still kept, and marks Freyr reachable again — which is what
 * tells an open page to refresh (sync.svelte.ts).
 */
async function fresh(
	event: FetchEvent,
	key: string,
	keep: (res: Response) => Promise<void>,
	missing: () => Promise<Response>
): Promise<Response> {
	const kept = await caches.match(key, { cacheName: PAGES });
	const network = fetch(event.request).then((res) => {
		// The proxy answering for a Freyr that is down is not an answer.
		if (res.status >= 502 && res.status <= 504) throw new Error(`upstream ${res.status}`);
		return res;
	});
	// Registered before the page's own read below, so the copy is taken first.
	event.waitUntil(
		network.then(
			(res) => {
				reached(true);
				return res.ok ? keep(res.clone()) : undefined;
			},
			() => reached(false)
		)
	);

	if (!kept) return network.catch(missing);
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			reached(false);
			resolve(kept);
		}, PATIENCE);
		network.then(
			(res) => {
				clearTimeout(timer);
				resolve(res);
			},
			() => {
				clearTimeout(timer);
				resolve(kept);
			}
		);
	});
}

async function keepPage(key: string, url: URL, res: Response): Promise<void> {
	if (PUBLIC.has(url.pathname) || res.type !== 'basic') return;
	if (!res.headers.get('content-type')?.includes('text/html')) return;
	await store(key, res);
}

async function keepData(key: string, res: Response): Promise<void> {
	const text = await res.text();
	const kept = await caches.match(key, { cacheName: PAGES });
	const merged = mergeData(text, kept ? await kept.text() : null);
	if (!merged) return;
	await store(key, json(merged));
	const layout = layoutData(text);
	if (layout) await (await caches.open(PAGES)).put(LAYOUT, json(layout));
}

/** Put, then drop the least recently refreshed pages beyond KEEP. */
async function store(key: string, res: Response): Promise<void> {
	const cache = await caches.open(PAGES);
	await cache.put(key, res);
	const keys = (await cache.keys()).filter((r) => r.url !== LAYOUT && r.url !== WARMED);
	for (const old of keys.slice(0, Math.max(0, keys.length - KEEP))) await cache.delete(old);
}

/**
 * A page's data was never kept. The router then shows the root error page,
 * asking for the root layout's data alone — answer that from any page, so
 * the notice sits inside the app; everything else is a 503 with a reason.
 */
async function missingData(url: URL): Promise<Response> {
	if (url.searchParams.get('x-sveltekit-invalidated') === '1') {
		const layout = await caches.match(LAYOUT, { cacheName: PAGES });
		if (layout) return layout;
	}
	return new Response(
		JSON.stringify("You're offline, and this page isn't saved on this device yet."),
		{
			status: 503,
			headers: { 'content-type': 'application/json' }
		}
	);
}

/** A navigation to a page never kept, with no connection to fetch it. */
function offline(): Response {
	return new Response(
		`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — Freyr</title><style>:root{color-scheme:light dark;--bg:#fff;--ink:#09090b;--ink-2:#52525b;--line:#dcdce0}@media (prefers-color-scheme:dark){:root{--bg:#111113;--ink:#ededef;--ink-2:#a1a1aa;--line:#2c2c31}}body{display:grid;place-items:center;min-height:100dvh;margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,sans-serif}main{max-width:22rem;padding:1.5rem}h1{margin:0 0 .25rem;font-size:1rem}p{margin:0 0 1rem;color:var(--ink-2)}a{display:inline-block;padding:.375rem .75rem;border:1px solid var(--line);border-radius:6px;color:inherit;font-weight:500;text-decoration:none}</style><main><h1>You're offline</h1><p>This page isn't saved on this device yet. The screens you've opened before are still here, and anything you add waits until you're back online.</p><a href="/">Open Home</a></main>`,
		{ status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }
	);
}

function json(body: string): Response {
	return new Response(body, { headers: { 'content-type': 'application/json' } });
}

/* ---- Writes: straight through, or queued in order ------------------------ */

/**
 * A plain form post: script off, or logging out. It cannot wait — nothing
 * would be left on screen to say so — so offline it gets the offline page.
 */
async function post(request: Request, url: URL): Promise<Response> {
	try {
		const res = await fetch(request);
		// Signed out: nothing of theirs stays readable on this device.
		if (url.pathname === '/logout') await caches.delete(PAGES);
		return res;
	} catch {
		return offline();
	}
}

/**
 * A script-sent write (a form action, the theme). Anything already waiting
 * goes first — the server must see writes in the order they were made — and
 * if that cannot happen yet, this one waits behind it. Otherwise it goes
 * straight out; if it cannot reach Freyr it joins the queue, and the page is
 * told it was held (202) rather than that it failed.
 */
async function write(request: Request): Promise<Response> {
	const item: QueuedWrite = {
		key: crypto.randomUUID(),
		url: request.url,
		headers: KEPT_HEADERS.flatMap((name): [string, string][] => {
			const value = request.headers.get(name);
			return value ? [[name, value]] : [];
		}),
		body: await request.text(),
		action: request.headers.get('x-sveltekit-action') === 'true',
		at: Date.now()
	};

	if ((await waiting()) > 0) {
		await flush();
		if ((await waiting()) > 0) return hold(item);
	}
	try {
		const res = await send(item, request.redirect);
		if (res.status >= 502 && res.status <= 504) return hold(item);
		reached(true);
		dirty = true;
		return res;
	} catch {
		reached(false);
		return hold(item);
	}
}

async function hold(item: QueuedWrite): Promise<Response> {
	await queue('readwrite', (s) => s.add(item));
	// Chromium retries in the background, even with the app closed; Safari has
	// no Background Sync, so there the open page asks (sync.svelte.ts).
	await (sw.registration as { sync?: { register(tag: string): Promise<void> } }).sync
		?.register('freyr-sync')
		.catch(() => {});
	void broadcast();
	return item.action
		? json(JSON.stringify({ type: 'success', status: 202 }))
		: new Response(null, { status: 202 });
}

function send(item: QueuedWrite, redirect: RequestRedirect): Promise<Response> {
	return fetch(item.url, {
		method: 'POST',
		headers: [...item.headers, [KEY_HEADER, item.key]],
		body: item.body,
		redirect,
		cache: 'no-store'
	});
}

let flushing: Promise<void> | null = null;
let needsAuth = false;

/** Replay the queue, oldest first; one run at a time. */
function flush(): Promise<void> {
	if (!flushing) {
		flushing = replay().finally(() => {
			flushing = null;
			void broadcast();
		});
		void broadcast();
	}
	return flushing;
}

async function replay(): Promise<void> {
	let synced = 0;
	for (const item of await queue('readonly', (s) => s.getAll() as IDBRequest<QueuedWrite[]>)) {
		if (item.error) continue;
		let res: Response;
		try {
			res = await send(item, 'manual');
		} catch {
			reached(false);
			break;
		}
		const verdict = judge(item, {
			status: res.status,
			opaqueRedirect: res.type === 'opaqueredirect',
			busy: res.headers.has(BUSY_HEADER),
			body: res.type === 'opaqueredirect' ? '' : await res.text()
		});
		if (verdict.kind === 'retry') {
			// Stop at the first one that cannot go yet: order matters.
			needsAuth = verdict.signIn;
			if (!verdict.signIn && !res.headers.has(BUSY_HEADER)) reached(false);
			break;
		}
		reached(true);
		needsAuth = false;
		if (verdict.kind === 'done') {
			await queue('readwrite', (s) => s.delete(item.id!));
			synced++;
		} else {
			await queue('readwrite', (s) => s.put({ ...item, error: verdict.message }));
		}
	}
	if (synced) {
		tell({ type: 'synced', count: synced });
		// The kept screens predate these writes.
		await warm();
	}
}

sw.addEventListener('sync', (event) => {
	const sync = event as ExtendableEvent & { tag: string };
	if (sync.tag !== 'freyr-sync') return;
	// Still waiting: reject, and the browser tries again later.
	sync.waitUntil(
		flush().then(async () => {
			if ((await waiting()) > 0) throw new Error('writes still waiting');
		})
	);
});

/* ---- Keeping the screens warm ------------------------------------------- */

/** A write went through since the screens were last kept. */
let dirty = false;
let warming: Promise<void> | null = null;

/**
 * Keep every screen for offline: the home page whole (a cold start opens on
 * it) and each screen's data (the router asks for that). After a release,
 * after a sync, and when the app is put away after a change.
 */
function warm(): Promise<void> {
	warming ??= (async () => {
		dirty = false;
		const results = await Promise.allSettled([
			fetch('/', { redirect: 'manual' }).then(async (res) => {
				if (res.ok) await keepPage(`${origin}/`, new URL(`${origin}/`), res);
				return res.ok;
			}),
			...SCREENS.map(async (path) => {
				const url = new URL(path === '/' ? '/__data.json' : `${path}/__data.json`, origin);
				const res = await fetch(url, { redirect: 'manual' });
				if (res.ok) await keepData(dataKey(url), res);
				return res.ok;
			})
		]);
		// Signed out, nothing was kept; try again when a page asks.
		if (results.some((r) => r.status === 'fulfilled' && r.value)) {
			await (await caches.open(PAGES)).put(WARMED, new Response(String(Date.now())));
		}
	})().finally(() => (warming = null));
	return warming;
}

/* ---- Talking to the pages ------------------------------------------------- */

/** Whether the last request reached Freyr. */
let online = true;
let lastReached = 0;

function reached(ok: boolean): void {
	if (ok) lastReached = Date.now();
	if (online === ok) return;
	online = ok;
	void broadcast();
	if (ok) void waiting().then((n) => n > 0 && flush());
}

/** Asked whether the connection is back, with nothing to send: ask the server. */
async function probe(): Promise<void> {
	if (online && Date.now() - lastReached < 10_000) return;
	try {
		const res = await fetch('/_app/version.json', { cache: 'no-store' });
		reached(res.status < 502);
	} catch {
		reached(false);
	}
}

async function status(): Promise<SyncStatus> {
	const all = await queue('readonly', (s) => s.getAll() as IDBRequest<QueuedWrite[]>);
	return {
		online,
		syncing: flushing != null,
		needsAuth,
		pending: all.filter((w) => !w.error).map(toSyncItem),
		failed: all.filter((w) => w.error).map(toSyncItem)
	};
}

function tell(message: FromWorker): void {
	sw.clients.matchAll({ type: 'window' }).then((clients) => {
		for (const client of clients) client.postMessage(message);
	});
}

async function broadcast(): Promise<void> {
	tell({ type: 'status', status: await status(), version });
}

sw.addEventListener('message', (event) => {
	const message = event.data as ToWorker;
	event.waitUntil(
		(async () => {
			switch (message.type) {
				case 'hello':
					await broadcast();
					if ((await waiting()) > 0) await flush();
					else await probe();
					if (!(await caches.match(WARMED, { cacheName: PAGES }))) await warm();
					return;
				case 'sync':
					if ((await waiting()) > 0) await flush();
					else await probe();
					return;
				case 'hidden':
					if (dirty) await warm();
					return;
				case 'retry': {
					const item = await queue('readonly', (s) => s.get(message.id) as IDBRequest<QueuedWrite>);
					if (!item) return;
					// It never applied, so a fresh key: the old one has an answer on record.
					await queue('readwrite', (s) =>
						s.put({ ...item, key: crypto.randomUUID(), error: undefined })
					);
					await flush();
					return;
				}
				case 'discard':
					await queue('readwrite', (s) => s.delete(message.id));
					await broadcast();
					return;
			}
		})()
	);
});

/* ---- The queue (IndexedDB) ------------------------------------------------ */

let db: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
	db ??= new Promise((resolve, reject) => {
		const req = indexedDB.open('freyr-sync', 1);
		req.onupgradeneeded = () =>
			req.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return db;
}

/** One request against the queue store, resolved when its transaction commits. */
async function queue<T>(
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const tx = (await open()).transaction('queue', mode);
	const req = run(tx.objectStore('queue'));
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve(req.result);
		tx.onerror = tx.onabort = () => reject(tx.error);
	});
}

/** How many writes are waiting to go (the refused ones wait for the user instead). */
async function waiting(): Promise<number> {
	const all = await queue('readonly', (s) => s.getAll() as IDBRequest<QueuedWrite[]>);
	return all.filter((w) => !w.error).length;
}
