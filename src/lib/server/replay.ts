/**
 * At most once, for writes the service worker may send twice. A write whose
 * answer was lost on a failing connection is replayed from the offline queue
 * under the key its first attempt carried; if that attempt did reach Freyr,
 * the replay gets the first answer again instead of a second transaction.
 *
 * In memory, bounded and short-lived: a replay follows within minutes or
 * hours, and the one gap — a restart between the two attempts — is a deploy.
 * A request without a key is untouched.
 */

import { BUSY_HEADER } from '$lib/offline';

/** Keys are the worker's `crypto.randomUUID()`; anything else is not ours. */
const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Headers worth repeating. Never set-cookie: the first answer already set it. */
const REPEATED = ['content-type', 'location', 'cache-control'];

interface Answer {
	status: number;
	headers: [string, string][];
	body: string;
}

export function isReplayKey(key: string | null): key is string {
	return key != null && KEY.test(key);
}

/**
 * `once(key, run)` runs the write the first time a key is seen and repeats
 * its answer after that. While the first run is still going, a second gets a
 * 409 marked busy, and the worker tries it again later. A 5xx is not kept: it
 * may not have applied, and the next attempt should really run.
 */
export function replayGuard({
	max = 256,
	ttl = 24 * 60 * 60 * 1000,
	maxBody = 64 * 1024,
	now = Date.now
}: { max?: number; ttl?: number; maxBody?: number; now?: () => number } = {}) {
	const seen = new Map<string, { at: number; answer?: Answer }>();

	function prune(at: number): void {
		// A Map iterates in insertion order, so the oldest are first.
		for (const [key, entry] of seen) {
			if (seen.size <= max && at - entry.at < ttl) break;
			seen.delete(key);
		}
	}

	return async function once(
		key: string,
		run: () => Response | Promise<Response>
	): Promise<Response> {
		const at = now();
		prune(at);
		const hit = seen.get(key);
		if (hit?.answer) {
			const { status, headers, body } = hit.answer;
			return new Response(body, { status, headers });
		}
		if (hit) {
			return new Response('The first attempt is still being applied.', {
				status: 409,
				headers: { [BUSY_HEADER]: '1' }
			});
		}

		const entry: { at: number; answer?: Answer } = { at };
		seen.set(key, entry);
		let res: Response;
		try {
			res = await run();
		} catch (err) {
			seen.delete(key);
			throw err;
		}

		const body = await res.text();
		if (res.status >= 500 || body.length > maxBody) seen.delete(key);
		else
			entry.answer = {
				status: res.status,
				headers: REPEATED.flatMap((name): [string, string][] => {
					const value = res.headers.get(name);
					return value ? [[name, value]] : [];
				}),
				body
			};
		return new Response(body, {
			status: res.status,
			statusText: res.statusText,
			headers: res.headers
		});
	};
}
