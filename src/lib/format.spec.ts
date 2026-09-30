import { describe, expect, it } from 'vitest';
import { delta, formatCell, formatCompact, share } from './format';

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

	// An overspent bucket is a bare negative: home, monthly and yearly all render
	// Remaining through this, and the minus is the only thing carrying the sign.
	it('renders an overspend bare, with a minus and no plus', () => {
		expect(formatCell(-1000)).toBe('-₹10');
		expect(formatCell(-1000, 'outflow')).toBe('-₹10');
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

describe('formatCompact', () => {
	it('prints small figures as whole rupees', () => {
		expect(formatCompact(0)).toBe('₹0');
		expect(formatCompact(95000)).toBe('₹950');
		expect(formatCompact(95049)).toBe('₹950');
	});

	it('uses thousands, lakhs and crores with one decimal dropped at zero', () => {
		expect(formatCompact(123400)).toBe('₹1.2K');
		expect(formatCompact(9500000)).toBe('₹95K');
		expect(formatCompact(123456700)).toBe('₹12.3L');
		expect(formatCompact(1500000000)).toBe('₹1.5Cr');
		expect(formatCompact(10000000)).toBe('₹1L');
	});

	// A hundred of one unit is one of the next: 99,960 is a lakh, not "100K".
	it('promotes a figure that rounds up into the next unit', () => {
		expect(formatCompact(9996000)).toBe('₹1L');
		expect(formatCompact(99960)).toBe('₹1K');
		expect(formatCompact(999_960_000)).toBe('₹1Cr');
	});

	it('keeps the sign on a negative', () => {
		expect(formatCompact(-123400)).toBe('-₹1.2K');
	});
});

describe('share', () => {
	it('rounds to a whole percentage', () => {
		expect(share(1, 3)).toBe('33%');
		expect(share(2, 3)).toBe('67%');
		expect(share(3, 3)).toBe('100%');
	});

	it('never lets a sliver read as zero', () => {
		expect(share(1, 1000)).toBe('<1%');
		expect(share(0, 1000)).toBe('0%');
	});

	it('has no share of an empty whole', () => {
		expect(share(5, 0)).toBe('—');
	});
});
