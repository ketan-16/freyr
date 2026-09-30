import { describe, expect, it } from 'vitest';
import { BUSY_HEADER } from '$lib/offline';
import { isReplayKey, replayGuard } from './replay';

const KEY = '0f8b6c1e-3a52-4c7e-9d1a-6b2f4e8c9a01';

/** A write that counts how often it really ran. */
function counter(res: () => Response = () => Response.json({ type: 'success', status: 200 })) {
	const runs = { n: 0 };
	const run = async () => {
		runs.n++;
		return res();
	};
	return { runs, run };
}

describe('replay guard', () => {
	it('runs a write once and repeats its answer to a replay', async () => {
		const once = replayGuard();
		const { runs, run } = counter(
			() =>
				new Response('{"type":"redirect","status":303,"location":"/ledger"}', {
					headers: { 'content-type': 'application/json', 'set-cookie': 'a=b' }
				})
		);
		const first = await once(KEY, run);
		const again = await once(KEY, run);
		expect(runs.n).toBe(1);
		expect(await first.text()).toBe(await again.text());
		expect(again.headers.get('content-type')).toBe('application/json');
		// The cookie went out with the first answer; a repeat does not set it again.
		expect(first.headers.get('set-cookie')).toBe('a=b');
		expect(again.headers.get('set-cookie')).toBeNull();
	});

	it('tells a replay that arrives mid-write to come back later', async () => {
		const once = replayGuard();
		let finish!: () => void;
		const slow = () =>
			new Promise<Response>((resolve) => (finish = () => resolve(new Response('done'))));
		const first = once(KEY, slow);
		const busy = await once(KEY, slow);
		expect(busy.status).toBe(409);
		expect(busy.headers.has(BUSY_HEADER)).toBe(true);
		finish();
		expect(await (await first).text()).toBe('done');
	});

	it('lets a write that errored run again', async () => {
		const once = replayGuard();
		const { runs, run } = counter(() => new Response('boom', { status: 500 }));
		await once(KEY, run);
		await once(KEY, run);
		expect(runs.n).toBe(2);
	});

	it('forgets keys after a day, and the oldest beyond its size', async () => {
		let clock = 0;
		const once = replayGuard({ max: 2, ttl: 1000, now: () => clock });
		const { runs, run } = counter();
		await once('a', run);
		clock = 1001;
		await once('a', run);
		expect(runs.n).toBe(2);
		await once('b', run);
		await once('c', run); // 'a' is now the oldest of three
		await once('a', run);
		expect(runs.n).toBe(5);
	});

	it('accepts only the worker’s own keys', () => {
		expect(isReplayKey(KEY)).toBe(true);
		expect(isReplayKey(null)).toBe(false);
		expect(isReplayKey('x'.repeat(36))).toBe(false);
		expect(isReplayKey(`${KEY}${'0'.repeat(1000)}`)).toBe(false);
	});
});
