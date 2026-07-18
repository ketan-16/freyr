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

	it('flags a POST with a foreign or missing origin', () => {
		expect(isCrossSiteWrite(req('POST', { host: 'localhost:3000' }))).toBe(true);
		expect(
			isCrossSiteWrite(req('POST', { host: 'localhost:3000', origin: 'http://evil.example' }))
		).toBe(true);
	});

	it('accepts a same-host POST regardless of protocol', () => {
		expect(
			isCrossSiteWrite(req('POST', { host: 'localhost:3000', origin: 'http://localhost:3000' }))
		).toBe(false);
	});
});
