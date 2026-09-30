/**
 * The page's side of offline: what the service worker reports — whether
 * Freyr is reachable, what waits to be sent, what the server refused — and
 * the few things a page asks of it. State only; the worker owns the queue
 * (src/service-worker.ts). One instance per app mount, through context.
 */

import { getContext, setContext } from 'svelte';
import { version } from '$app/environment';
import type { FromWorker, SyncItem, ToWorker } from '$lib/offline';

/** While writes wait and the app is open, ask the worker to try again this often. */
const RETRY = 30_000;

export class Sync {
	/** A service worker runs this page, so offline support is on. */
	active = $state(false);
	syncing = $state(false);
	/** The session ended while writes waited: they go once you sign in. */
	needsAuth = $state(false);
	pending = $state<SyncItem[]>([]);
	failed = $state<SyncItem[]>([]);
	/** The worker is a newer release than the code this page is running. */
	updated = false;

	/** The browser has a network at all. */
	#network = $state(true);
	/** The worker's last request reached Freyr. */
	#reached = $state(true);
	online = $derived(this.#network && this.#reached);

	send(message: ToWorker): void {
		navigator.serviceWorker?.controller?.postMessage(message);
	}

	/**
	 * Listen to the worker and to the things that mean "try now": the network
	 * returning, the app coming back to the foreground. Safari has no
	 * Background Sync, so these are how a queue drains there. `refresh`
	 * reloads the page's data after writes land or the connection returns;
	 * `synced` reports how many writes just went through.
	 */
	start(refresh: () => void, synced: (count: number) => void): () => void {
		if (!('serviceWorker' in navigator)) return () => {};
		const sw = navigator.serviceWorker;

		let pendingRefresh: ReturnType<typeof setTimeout> | undefined;
		// A reconnect and the sync it triggers arrive together: refresh once.
		const soon = () => {
			clearTimeout(pendingRefresh);
			pendingRefresh = setTimeout(refresh, 250);
		};

		const hello = () => {
			this.active = sw.controller != null;
			this.send({ type: 'hello' });
		};
		const onMessage = (e: MessageEvent<FromWorker>) => {
			const message = e.data;
			if (message?.type === 'status') {
				const was = this.online;
				const s = message.status;
				this.#reached = s.online;
				this.syncing = s.syncing;
				this.needsAuth = s.needsAuth;
				this.pending = s.pending;
				this.failed = s.failed;
				this.updated = message.version !== version;
				if (!was && this.online) soon();
			} else if (message?.type === 'synced') {
				synced(message.count);
				soon();
			}
		};
		const onControl = hello;
		const onOnline = () => {
			this.#network = true;
			this.send({ type: 'sync' });
		};
		const onOffline = () => (this.#network = false);
		const onVisibility = () =>
			this.send({ type: document.visibilityState === 'visible' ? 'sync' : 'hidden' });
		const timer = setInterval(() => {
			if (this.pending.length && document.visibilityState === 'visible')
				this.send({ type: 'sync' });
		}, RETRY);

		this.#network = navigator.onLine;
		sw.addEventListener('message', onMessage);
		sw.addEventListener('controllerchange', onControl);
		addEventListener('online', onOnline);
		addEventListener('offline', onOffline);
		document.addEventListener('visibilitychange', onVisibility);
		hello();

		return () => {
			clearTimeout(pendingRefresh);
			clearInterval(timer);
			sw.removeEventListener('message', onMessage);
			sw.removeEventListener('controllerchange', onControl);
			removeEventListener('online', onOnline);
			removeEventListener('offline', onOffline);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}
}

const KEY = Symbol('freyr-sync');

export function provideSync(): Sync {
	return setContext(KEY, new Sync());
}

export function useSync(): Sync {
	return getContext<Sync>(KEY);
}
