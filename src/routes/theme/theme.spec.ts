import { isRedirect } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { POST } from './+server';

type Call = [op: 'set' | 'delete', name: string, value: string | null, opts: object];

/** Post the form and report what happened to the cookie, and where it sent us. */
async function post(form: Record<string, string>): Promise<{ calls: Call[]; location: string }> {
	const calls: Call[] = [];
	const cookies = {
		set: (name: string, value: string, opts: object) => calls.push(['set', name, value, opts]),
		delete: (name: string, opts: object) => calls.push(['delete', name, null, opts])
	};
	const request = new Request('http://localhost/theme', {
		method: 'POST',
		body: new URLSearchParams(form)
	});
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await POST({ request, cookies } as any);
	} catch (e) {
		if (isRedirect(e)) return { calls, location: e.location };
		throw e;
	}
	throw new Error('expected a redirect');
}

describe('/theme', () => {
	it('keeps light or dark in a cookie readable over plain HTTP', async () => {
		for (const to of ['light', 'dark']) {
			const { calls } = await post({ to });
			expect(calls).toEqual([
				['set', 'freyr_theme', to, expect.objectContaining({ path: '/', secure: false })]
			]);
		}
	});

	it('clears the cookie for system, so the OS decides again', async () => {
		const { calls } = await post({ to: 'system' });
		expect(calls).toEqual([
			['delete', 'freyr_theme', null, expect.objectContaining({ path: '/', secure: false })]
		]);
	});

	it('treats anything unrecognised as light', async () => {
		const { calls } = await post({ to: 'sepia' });
		expect(calls).toEqual([['set', 'freyr_theme', 'light', expect.any(Object)]]);
	});

	it('returns only to a path on this site', async () => {
		expect((await post({ to: 'dark', back: '/ledger?month=8' })).location).toBe('/ledger?month=8');
		expect((await post({ to: 'dark', back: 'https://example.com/' })).location).toBe('/');
		expect((await post({ to: 'dark', back: '//example.com/' })).location).toBe('/');
		expect((await post({ to: 'dark' })).location).toBe('/');
	});
});
