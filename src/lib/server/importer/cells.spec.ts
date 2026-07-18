import { describe, expect, it } from 'vitest';
import {
	cellDate,
	cellNumber,
	cellPaise,
	cellString,
	lakhsToPaise,
	paiseFromNumber,
	quarterLabelToDate,
	ratioToBP
} from './cells';

describe('cellNumber', () => {
	it('reads plain numbers and formula results', () => {
		expect(cellNumber(42)).toBe(42);
		expect(cellNumber({ formula: 'B2*C2', result: 24730.935 } as never)).toBe(24730.935);
		expect(cellNumber('NA')).toBeNull();
		expect(cellNumber({ formula: 'X', result: 'NA' } as never)).toBeNull();
		expect(cellNumber(null)).toBeNull();
	});
});

describe('cellString', () => {
	it('reads strings, numbers and rich text', () => {
		expect(cellString(' Makarand ')).toBe('Makarand');
		expect(cellString(85011897)).toBe('85011897');
		expect(cellString({ richText: [{ text: 'a' }, { text: 'b' }] } as never)).toBe('ab');
		expect(cellString(null)).toBe('');
	});
});

describe('cellDate', () => {
	it('reads date cells as ISO strings', () => {
		expect(cellDate(new Date(Date.UTC(2024, 7, 1)))).toBe('2024-08-01');
		expect(cellDate('2024-08-01')).toBeNull();
	});
});

describe('paiseFromNumber', () => {
	it('converts through the 2-decimal string form', () => {
		expect(paiseFromNumber(140209)).toBe(14020900);
		expect(paiseFromNumber(24730.93531121518)).toBe(2473094);
		expect(paiseFromNumber(28058.65)).toBe(2805865);
		expect(paiseFromNumber(0.8499999999985448)).toBe(85);
	});
});

describe('cellPaise', () => {
	it('returns null for text cells like NA', () => {
		expect(cellPaise('NA')).toBeNull();
		expect(cellPaise({ formula: 'X', result: 24046.5 } as never)).toBe(2404650);
	});
});

describe('ratioToBP', () => {
	it('rounds workbook ratios to basis points', () => {
		expect(ratioToBP(0.3086081998479501)).toBe(3086);
		expect(ratioToBP(0.29999999999999993)).toBe(3000);
		expect(ratioToBP(0.3913918001520499)).toBe(3914);
		expect(ratioToBP(0.27199748084053704)).toBe(2720);
		expect(ratioToBP(0.43)).toBe(4300);
	});
});

describe('lakhsToPaise', () => {
	it('multiplies out lakh covers', () => {
		expect(lakhsToPaise(10)).toBe(100000000);
		expect(lakhsToPaise(200)).toBe(2000000000);
	});
});

describe('quarterLabelToDate', () => {
	it.each([
		['Q3 2024', '2024-09-30'],
		['Q4 2024', '2024-12-31'],
		['Q1 2025', '2025-03-31'],
		['Pre-Q3 2024', '2024-06-30'],
		['Pre-Q1 2025', '2024-12-31']
	])('%s → %s', (label, expected) => {
		expect(quarterLabelToDate(label)).toBe(expected);
	});

	it('rejects junk', () => {
		expect(() => quarterLabelToDate('sometime')).toThrow();
	});
});
