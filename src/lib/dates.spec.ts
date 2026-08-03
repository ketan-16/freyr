import { describe, expect, it } from 'vitest';
import { monthStart } from './dates';

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
