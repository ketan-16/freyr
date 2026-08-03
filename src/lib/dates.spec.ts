import { describe, expect, it } from 'vitest';
import { monthStart, daysInMonth, dayBoundIn } from './dates';

describe('monthStart', () => {
	it('snaps a mid-month date to the first of that month', () => {
		expect(monthStart('2025-09-15')).toBe('2025-09-01');
	});

	it('leaves a first-of-month date alone', () => {
		expect(monthStart('2025-09-01')).toBe('2025-09-01');
	});

	it('handles December without rolling the year', () => {
		expect(monthStart('2025-12-31')).toBe('2025-12-01');
	});
});

describe('daysInMonth', () => {
	it('knows month lengths including leap February', () => {
		expect(daysInMonth(2026, 1)).toBe(31);
		expect(daysInMonth(2026, 2)).toBe(28);
		expect(daysInMonth(2024, 2)).toBe(29);
		expect(daysInMonth(2026, 4)).toBe(30);
		expect(daysInMonth(2026, 12)).toBe(31);
	});
});

describe('dayBoundIn', () => {
	it('bounds the first N days of a month, exclusive', () => {
		expect(dayBoundIn(2026, 7, 4)).toBe('2026-07-05');
		expect(dayBoundIn(2026, 7, 1)).toBe('2026-07-02');
	});

	it('rolls to the next month when the whole month is covered', () => {
		expect(dayBoundIn(2026, 7, 31)).toBe('2026-08-01');
		expect(dayBoundIn(2026, 12, 31)).toBe('2027-01-01');
	});

	// 31 March has no counterpart in February; comparing "through the 31st"
	// must mean all of February, not three days of March.
	it('clamps a day the target month does not have', () => {
		expect(dayBoundIn(2026, 2, 31)).toBe('2026-03-01');
		expect(dayBoundIn(2024, 2, 30)).toBe('2024-03-01');
	});
});
