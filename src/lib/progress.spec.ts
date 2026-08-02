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
		expect(meter(7900, 10000)).toEqual({ pct: 79, width: 79, klass: '' });
	});

	it('warns from 80% up to and including 100%', () => {
		expect(meter(8000, 10000)).toEqual({ pct: 80, width: 80, klass: 'warn' });
		expect(meter(10000, 10000)).toEqual({ pct: 100, width: 100, klass: 'warn' });
	});

	it('flags an overspend and clamps the bar width', () => {
		expect(meter(14300, 10000)).toEqual({ pct: 143, width: 100, klass: 'over' });
	});

	it('keeps zero spend at zero rather than hiding the meter', () => {
		expect(meter(0, 10000)).toEqual({ pct: 0, width: 0, klass: '' });
	});
});
