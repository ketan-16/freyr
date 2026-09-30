import { describe, expect, it } from 'vitest';
import { isCrossSiteWrite, isSameHostOrigin } from './csrf';

describe('isSameHostOrigin', () => {
	it.each([
		['http://localhost:3000', 'localhost:3000', true],
		['https://localhost:3000', 'localhost:3000', true], // protocol-agnostic
		['http://192.168.0.102:3000', '192.168.0.102:3000', true],
		['http://evil.example', 'localhost:3000', false],
		['http://localhost:9999', 'localhost:3000', false],
		[null, 'localhost:3000', false],
		['http://localhost:3000', null, false],
		['not a url', 'localhost:3000', false]
	])('origin %s vs host %s → %s', (origin, host, expected) => {
		expect(isSameHostOrigin(origin, host)).toBe(expected);
	});
});

describe('isCrossSiteWrite', () => {
	function req(method: string, headers: Record<string, string>): Request {
		return new Request('http://localhost:3000/x', { method, headers });
	}

	it('never flags safe methods', () => {
		expect(isCrossSiteWrite(req('GET', {}))).toBe(false);
	});

	it('flags a POST from a foreign origin', () => {
		expect(
			isCrossSiteWrite(req('POST', { host: 'localhost:3000', origin: 'http://evil.example' }))
		).toBe(true);
	});

	it('allows a POST with no or "null" Origin (same-origin form nav, e.g. Safari)', () => {
		// Safari sends no Origin — or the literal "null" when the referrer is
		// suppressed — on a same-origin form navigation. A cross-site attacker's
		// request names a real foreign host, so neither is a forgery.
		expect(isCrossSiteWrite(req('POST', { host: 'localhost:3000' }))).toBe(false);
		expect(isCrossSiteWrite(req('POST', { host: 'localhost:3000', origin: 'null' }))).toBe(false);
	});

	it('accepts a same-host POST regardless of protocol', () => {
		expect(
			isCrossSiteWrite(req('POST', { host: 'localhost:3000', origin: 'http://localhost:3000' }))
		).toBe(false);
	});
});
