import { describe, expect, it } from 'vitest';
import { meter } from './progress';

describe('meter', () => {
	it('returns null when there is nothing to measure against', () => {
		expect(meter(500, null)).toBeNull();
		expect(meter(500, undefined)).toBeNull();
		expect(meter(500, 0)).toBeNull();
		expect(meter(500, -100)).toBeNull();
	});

	it('reports brand state below 80%', () => {
		expect(meter(7900, 10000)).toEqual({ pct: 79, width: 79, overflow: 0, klass: '' });
	});

	it('warns from 80% up to and including 100%', () => {
		expect(meter(8000, 10000)).toEqual({ pct: 80, width: 80, overflow: 0, klass: 'warn' });
		expect(meter(10000, 10000)).toEqual({ pct: 100, width: 100, overflow: 0, klass: 'warn' });
	});

	it('keeps zero spend at zero rather than hiding the meter', () => {
		expect(meter(0, 10000)).toEqual({ pct: 0, width: 0, overflow: 0, klass: '' });
	});

	// Over the cap the track rescales to pct: the allocation occupies
	// 100/pct of it and the excess occupies the rest, so the overspend is
	// visible as a distinct segment instead of vanishing into a full bar.
	it('splits the track into allocation and excess when over', () => {
		expect(meter(20000, 10000)).toEqual({ pct: 200, width: 50, overflow: 50, klass: 'over' });
		expect(meter(14300, 10000)).toEqual({ pct: 143, width: 70, overflow: 30, klass: 'over' });
	});

	it('keeps width and overflow summing to the full track', () => {
		const m = meter(33333, 10000);
		expect(m!.width + m!.overflow).toBe(100);
	});

	it('never returns a negative width for a negative actual', () => {
		expect(meter(-500, 10000)).toEqual({ pct: -5, width: 0, overflow: 0, klass: '' });
	});
});
