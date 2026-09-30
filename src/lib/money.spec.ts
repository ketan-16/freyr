import { describe, expect, it } from 'vitest';
import {
	formatBP,
	formatMoney,
	fromRupees,
	mulBP,
	parseMoney,
	parsePercentBP,
	toAmountInput
} from './money';

describe('parseMoney', () => {
	it.each([
		['1234', 123400],
		['123456.78', 12345678],
		['1,23,456.78', 12345678],
		['₹1,234', 123400],
		['₹ 1,234.50', 123450],
		['-500', -50000],
		['0.05', 5],
		['140209', 14020900],
		['1,40,209.5', 14020950]
	])('parses %s → %d paise', (input, expected) => {
		expect(parseMoney(input)).toBe(expected);
	});

	it.each([[''], ['abc'], ['1.234'], ['1..2'], ['--5'], ['.'], ['1,2a3']])(
		'rejects %s',
		(input) => {
			expect(() => parseMoney(input)).toThrow();
		}
	);
});

describe('formatMoney', () => {
	it.each([
		[12345678, '₹1,23,456.78'],
		[1000000, '₹10,000'],
		[123400, '₹1,234'],
		[123456789, '₹12,34,567.89'],
		[50, '₹0.50'],
		[0, '₹0'],
		[-123450, '-₹1,234.50'],
		[fromRupees(1234567), '₹12,34,567']
	])('formats %d → %s', (paise, expected) => {
		expect(formatMoney(paise)).toBe(expected);
	});
});

describe('mulBP', () => {
	it.each([
		[fromRupees(100000), 2720, fromRupees(27200)],
		[fromRupees(100000), 3000, fromRupees(30000)],
		[fromRupees(100000), 4280, fromRupees(42800)],
		[1, 5000, 1], // 0.5 paise rounds away from zero
		[-1, 5000, -1], // symmetric for negatives
		[3, 3333, 1],
		[10000, 0, 0]
	])('mulBP(%d, %d) = %d', (paise, bp, expected) => {
		expect(mulBP(paise, bp)).toBe(expected);
	});
});

describe('parsePercentBP', () => {
	it.each([
		['27.20', 2720],
		['30', 3000],
		['42.80', 4280],
		['42.8', 4280],
		['100', 10000],
		['0.05', 5]
	])('parses %s → %d bp', (input, expected) => {
		expect(parsePercentBP(input)).toBe(expected);
	});

	// Eleven inputs on /settings/budget parse through here, so a rejection has to
	// read as a sentence about a percentage — not as a money-module fragment
	// saying "amount" on a field that asks for a percent.
	it.each([
		['', 'Enter a percentage like 27.20.'],
		['abc', 'Enter a percentage like 27.20 (got "abc").'],
		['1.234', 'Enter a percentage like 27.20 (got "1.234").'],
		['1..2', 'Enter a percentage like 27.20 (got "1..2").'],
		['-5', 'A percentage cannot be negative (got "-5").']
	])('rejects %s with a sentence', (input, message) => {
		expect(() => parsePercentBP(input)).toThrow(message);
	});

	it('keeps the money-module wording as the cause, not as the message', () => {
		expect.assertions(2);
		try {
			parsePercentBP('1.234');
		} catch (err) {
			expect((err as Error).message).not.toMatch(/amount/);
			expect(((err as Error).cause as Error).message).toBe(
				'amount "1.234" has more than 2 decimal places'
			);
		}
	});
});

describe('formatBP', () => {
	it.each([
		[2720, '27.20%'],
		[3000, '30.00%'],
		[10000, '100.00%'],
		[5, '0.05%']
	])('formats %d → %s', (bp, expected) => {
		expect(formatBP(bp)).toBe(expected);
	});
});

describe('fromRupees', () => {
	it('converts whole rupees', () => {
		expect(fromRupees(100)).toBe(10000);
	});
	it('rejects non-integers', () => {
		expect(() => fromRupees(1.5)).toThrow();
	});
});

describe('toAmountInput', () => {
	it('prints whole rupees without decimals and paise with two', () => {
		expect(toAmountInput(100000)).toBe('1000');
		expect(toAmountInput(125050)).toBe('1250.50');
		expect(toAmountInput(5)).toBe('0.05');
	});

	// The point of the function: an edit form seeds its field with this and
	// posts it straight back through parseMoney.
	it('round-trips through parseMoney', () => {
		for (const p of [1, 99, 100, 125050, 1234567890]) expect(parseMoney(toAmountInput(p))).toBe(p);
	});

	it('refuses a negative or fractional amount', () => {
		expect(() => toAmountInput(-1)).toThrow();
		expect(() => toAmountInput(1.5)).toThrow();
	});
});
