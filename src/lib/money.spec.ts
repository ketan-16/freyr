import { describe, expect, it } from 'vitest';
import {
	evaluateAmount,
	formatBP,
	formatMoney,
	fromRupees,
	hasOperator,
	mulBP,
	parseMoney,
	parsePercentBP,
	groupTyped,
	keyAmount,
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

describe('groupTyped', () => {
	it('groups whole rupees the Indian way and keeps decimals as typed', () => {
		expect(groupTyped('125050.5')).toBe('1,25,050.5');
		expect(groupTyped('1234567')).toBe('12,34,567');
		expect(groupTyped('999')).toBe('999');
		expect(groupTyped('.5')).toBe('0.5');
		expect(groupTyped('')).toBe('');
	});
});

describe('keyAmount', () => {
	const type = (keys: string[]) => keys.reduce(keyAmount, '');

	it('builds a grouped amount digit by digit', () => {
		expect(type(['1', '2', '5', '0', '5', '0'])).toBe('1,25,050');
		expect(type(['5', '00'])).toBe('500');
	});

	it('takes one point and at most two decimals', () => {
		expect(type(['.', '5'])).toBe('0.5');
		expect(type(['1', '2', '.', '5', '0', '9'])).toBe('12.50');
		expect(type(['1', '.', '.', '5'])).toBe('1.5');
		expect(type(['1', '.', '5', '00'])).toBe('1.50');
	});

	it('drops leading zeros but keeps a lone zero', () => {
		expect(type(['0'])).toBe('0');
		expect(type(['0', '0'])).toBe('0');
		expect(type(['00'])).toBe('0');
		expect(type(['0', '7'])).toBe('7');
	});

	it('deletes the last character typed', () => {
		expect(keyAmount('1,250', 'del')).toBe('125');
		expect(keyAmount('12.', 'del')).toBe('12');
		expect(keyAmount('', 'del')).toBe('');
	});

	it('stops at nine whole-rupee digits', () => {
		expect(type(['9', '9', '9', '9', '9', '9', '9', '9', '9', '9'])).toBe('99,99,99,999');
		expect(type(['1', '2', '3', '4', '5', '6', '7', '8', '00'])).toBe('1,23,45,678');
	});

	// The point of the exercise: what the keypad builds, the server can read.
	it('always yields what parseMoney reads back exactly', () => {
		expect(parseMoney(type(['1', '2', '5', '0', '.', '5']))).toBe(125050);
		expect(parseMoney(type(['2', '00', '00']))).toBe(2000000);
	});
});

describe('keyAmount, with the calculator keys', () => {
	const type = (keys: string[]) => keys.reduce(keyAmount, '');

	it('starts the next number of a sum, each grouped on its own', () => {
		expect(type(['1', '2', '0', '0', '+', '4', '5'])).toBe('1,200 + 45');
		expect(type(['9', '×', '1', '2', '5', '0', '0', '0'])).toBe('9 × 1,25,000');
		expect(type(['1', '.', '5', '÷', '3', '−', '.', '2'])).toBe('1.5 ÷ 3 − 0.2');
	});

	it('swaps an operator pressed twice, and never starts with one', () => {
		expect(type(['1', '2', '+', '×'])).toBe('12 × ');
		expect(type(['+'])).toBe('');
		expect(type(['−', '5'])).toBe('5');
	});

	it('applies the lone-amount rules to each number', () => {
		expect(type(['5', '+', '0', '0', '7'])).toBe('5 + 7');
		expect(type(['5', '+', '1', '.', '2', '3', '4'])).toBe('5 + 1.23');
		expect(type(['1', '+', '9', '9', '9', '9', '9', '9', '9', '9', '9', '9'])).toBe(
			'1 + 99,99,99,999'
		);
	});

	it('deletes back through numbers and operators', () => {
		expect(keyAmount('12 + 45', 'del')).toBe('12 + 4');
		expect(keyAmount('12 + 4', 'del')).toBe('12 + ');
		expect(keyAmount('12 + ', 'del')).toBe('12');
		expect(keyAmount('1,200 + ', 'del')).toBe('1,200');
	});

	it('says when there is a sum to work out', () => {
		expect(hasOperator('1,200 + 45')).toBe(true);
		expect(hasOperator('12 + ')).toBe(true);
		expect(hasOperator('1,200')).toBe(false);
		expect(hasOperator('')).toBe(false);
	});
});

describe('evaluateAmount', () => {
	it('adds, subtracts, multiplies and divides in paise', () => {
		expect(evaluateAmount('1,200 + 45')).toBe(124500);
		expect(evaluateAmount('500 − 120.50')).toBe(37950);
		expect(evaluateAmount('120 × 3')).toBe(36000);
		expect(evaluateAmount('12.5 × 1.5')).toBe(1875);
		expect(evaluateAmount('1,000 ÷ 4')).toBe(25000);
	});

	it('multiplies and divides before it adds and subtracts', () => {
		expect(evaluateAmount('50 + 3 × 120')).toBe(41000);
		expect(evaluateAmount('100 − 20 ÷ 4 × 2')).toBe(9000);
		expect(evaluateAmount('10 − 2 − 3')).toBe(500);
		expect(evaluateAmount('240 ÷ 2 ÷ 3')).toBe(4000);
	});

	it('works in exact fractions and rounds once, halves away from zero', () => {
		// 1000 ÷ 3 = 333.333…: the rounding is at the end, not at each step.
		expect(evaluateAmount('1,000 ÷ 3')).toBe(33333);
		expect(evaluateAmount('1,000 ÷ 3 × 3')).toBe(100000);
		expect(evaluateAmount('0.01 × 0.5')).toBe(1);
		expect(evaluateAmount('0.05 ÷ 2')).toBe(3);
	});

	it('stays exact past the float range', () => {
		expect(evaluateAmount('99,99,99,999 × 99,99,99,999 ÷ 99,99,99,999')).toBe(99999999900);
	});

	it('ignores a trailing operator', () => {
		expect(evaluateAmount('1,200 + ')).toBe(120000);
	});

	it('refuses what cannot be an amount, in words', () => {
		expect(() => evaluateAmount('5 ÷ 0')).toThrow('Can’t divide by zero.');
		expect(() => evaluateAmount('100 − 180')).toThrow(
			'That comes to -₹80; an amount has to be more than ₹0.'
		);
		expect(() => evaluateAmount('5 − 5')).toThrow('more than ₹0');
		expect(() => evaluateAmount('99,99,99,999 + 1')).toThrow('more than ₹99,99,99,999.99');
		expect(() => evaluateAmount('0.001 × 1')).toThrow();
	});

	// What the calculator hands back, the keypad and the server both read.
	it('round-trips through the field', () => {
		const paise = evaluateAmount('1,250.50 × 2 + 0.25');
		expect(paise).toBe(250125);
		expect(parseMoney(groupTyped(toAmountInput(paise)))).toBe(paise);
	});
});
