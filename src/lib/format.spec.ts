import { describe, expect, it } from 'vitest';
import { delta, formatCell } from './format';

describe('formatCell', () => {
	it('renders zero as an em dash, never as ₹0.00', () => {
		expect(formatCell(0)).toBe('—');
		expect(formatCell(0, 'income')).toBe('—');
		expect(formatCell(0, 'outflow')).toBe('—');
	});

	it('renders an outflow bare', () => {
		expect(formatCell(125050)).toBe('₹1,250.50');
		expect(formatCell(125050, 'outflow')).toBe('₹1,250.50');
	});

	it('marks an inflow with an explicit plus', () => {
		expect(formatCell(125050, 'income')).toBe('+₹1,250.50');
	});

	it('does not stack a plus onto a negative', () => {
		expect(formatCell(-125050, 'income')).toBe('-₹1,250.50');
	});
});

describe('delta', () => {
	it('reports a rise as up and good by default', () => {
		expect(delta(50000, 30000)).toEqual({ klass: 'pos', arrow: '▲', text: '+₹200' });
	});

	it('reports a fall as down and bad by default', () => {
		expect(delta(30000, 50000)).toEqual({ klass: 'neg', arrow: '▼', text: '-₹200' });
	});

	it('reports no change as flat', () => {
		expect(delta(50000, 50000)).toEqual({ klass: 'flat', arrow: '—', text: '—' });
	});

	// The whole reason the option exists: spending more is bad news, but the
	// movement is still upward. The arrow reports direction; the class reports
	// whether that direction is good.
	it('keeps the arrow up but flips the class when lower is better', () => {
		expect(delta(50000, 30000, { lowerIsBetter: true })).toEqual({
			klass: 'neg',
			arrow: '▲',
			text: '+₹200'
		});
	});

	it('keeps the arrow down but flips the class when lower is better', () => {
		expect(delta(30000, 50000, { lowerIsBetter: true })).toEqual({
			klass: 'pos',
			arrow: '▼',
			text: '-₹200'
		});
	});
});
