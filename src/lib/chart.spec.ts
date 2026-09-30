import { describe, expect, it } from 'vitest';
import { areaPath, cumulative, linePath, niceScale, pct } from './chart';

describe('niceScale', () => {
	it('lands ticks on round steps at or above the largest value', () => {
		expect(niceScale(15446300)).toEqual({
			top: 20000000,
			ticks: [0, 5000000, 10000000, 15000000, 20000000]
		});
		expect(niceScale(900, 3)).toEqual({ top: 1000, ticks: [0, 500, 1000] });
	});

	it('uses a 2.5 step where it fits better than 5', () => {
		expect(niceScale(9000, 4).ticks).toEqual([0, 2500, 5000, 7500, 10000]);
	});

	it('still draws an axis for an empty series', () => {
		expect(niceScale(0)).toEqual({ top: 1, ticks: [0, 1] });
	});
});

describe('pct', () => {
	it('places a value inside the plot', () => {
		expect(pct(50, 200)).toBe(25);
		expect(pct(300, 200)).toBe(100);
		expect(pct(-1, 200)).toBe(0);
		expect(pct(5, 0)).toBe(0);
	});
});

describe('cumulative', () => {
	it('runs totals from an empty start, carrying quiet days', () => {
		const byDay = new Map([
			[1, 100],
			[3, 50]
		]);
		expect(cumulative(byDay, 4)).toEqual([0, 100, 100, 150, 150]);
	});
});

describe('linePath', () => {
	it('flips y so a higher value draws higher', () => {
		expect(
			linePath([
				[0, 0],
				[50, 25],
				[100, 100]
			])
		).toBe('M0 100L50 75L100 0');
	});
});

describe('areaPath', () => {
	it('closes the line down to the baseline', () => {
		expect(
			areaPath([
				[0, 0],
				[100, 50]
			])
		).toBe('M0 100L100 50L100 100L0 100Z');
		expect(areaPath([])).toBe('');
	});
});
