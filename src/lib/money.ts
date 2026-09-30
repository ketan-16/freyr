/**
 * Money as integer paise; percentages as integer basis points.
 * All parsing/arithmetic is integer/string math — floats never touch money.
 */

/** An amount in paise (1/100 rupee). Always an integer; negative allowed for arithmetic. */
export type Paise = number;

/** Converts whole rupees to paise. */
export function fromRupees(r: number): Paise {
	if (!Number.isInteger(r)) throw new Error(`fromRupees expects an integer, got ${r}`);
	return r * 100;
}

/**
 * Parses a user- or spreadsheet-entered amount into paise.
 * Accepts an optional ₹ prefix, commas, spaces, a leading '-', and up to two decimals.
 */
export function parseMoney(s: string): Paise {
	const orig = s;
	let t = s.trim().replace(/^₹/, '').replaceAll(',', '').replaceAll(' ', '');
	if (t === '') throw new Error('empty amount');
	let negative = false;
	if (t.startsWith('-')) {
		negative = true;
		t = t.slice(1);
	}
	const dot = t.indexOf('.');
	let whole = dot === -1 ? t : t.slice(0, dot);
	const frac = dot === -1 ? '' : t.slice(dot + 1);
	if (whole === '' && frac === '') throw new Error(`invalid amount "${orig}"`);
	if (whole === '') whole = '0';
	if (frac.length > 2) throw new Error(`amount "${orig}" has more than 2 decimal places`);
	const digits = whole + frac.padEnd(2, '0');
	if (!/^\d+$/.test(digits)) throw new Error(`invalid amount "${orig}"`);
	const paise = Number(digits);
	if (!Number.isSafeInteger(paise)) throw new Error(`amount "${orig}" is too large`);
	return negative ? -paise : paise;
}

/**
 * Formats paise with the ₹ symbol and Indian digit grouping (last 3 digits, then pairs).
 * Whole-rupee amounts omit the decimals: ₹10,000. Negatives render as -₹….
 */
export function formatMoney(p: Paise): string {
	const sign = p < 0 ? '-' : '';
	const abs = Math.abs(p);
	const rupees = Math.trunc(abs / 100);
	const paise = abs % 100;
	const grouped = groupIndian(String(rupees));
	const decimals = paise === 0 ? '' : `.${String(paise).padStart(2, '0')}`;
	return `${sign}₹${grouped}${decimals}`;
}

/**
 * Paise as the plain decimal an amount field accepts back: 125050 → "1250.50",
 * 100000 → "1000". The inverse of `parseMoney` for the non-negative amounts a
 * transaction stores — no symbol and no grouping, so an edit form can seed its
 * field with it and post it straight back.
 */
export function toAmountInput(p: Paise): string {
	if (!Number.isSafeInteger(p) || p < 0)
		throw new Error(`toAmountInput expects non-negative paise, got ${p}`);
	const paise = p % 100;
	return paise === 0
		? String(Math.trunc(p / 100))
		: `${Math.trunc(p / 100)}.${String(paise).padStart(2, '0')}`;
}

/**
 * A typed amount with its whole rupees grouped the Indian way and its
 * decimals left exactly as typed: "125050.5" → "1,25,050.5". Display only —
 * parseMoney reads the grouped form straight back.
 */
export function groupTyped(typed: string): string {
	const [whole, frac] = typed.replaceAll(',', '').split('.');
	const grouped = whole === '' ? '' : groupIndian(whole);
	return frac === undefined ? grouped : `${grouped || '0'}.${frac}`;
}

/** Whole-rupee digits the keypad accepts: up to ₹99,99,99,999. */
const KEYPAD_WHOLE_DIGITS = 9;

/**
 * One press of the phone keypad applied to a typed amount: a digit, "00",
 * "." or "del". String work only — the amount never becomes a number here —
 * and the result is always something parseMoney accepts once it has a digit:
 * one point, at most two decimals, no leading zeros, grouped for reading.
 */
export function keyAmount(typed: string, key: string): string {
	let raw = typed.replaceAll(',', '');
	if (key === 'del') {
		raw = raw.slice(0, -1);
	} else if (key === '.') {
		if (!raw.includes('.')) raw = `${raw || '0'}.`;
	} else if (/^\d+$/.test(key)) {
		const dot = raw.indexOf('.');
		if (dot >= 0) {
			raw += key.slice(0, Math.max(0, 2 - (raw.length - dot - 1)));
		} else {
			const whole = (raw + key).replace(/^0+(?=\d)/, '');
			if (whole.length <= KEYPAD_WHOLE_DIGITS) raw = whole;
		}
	}
	return groupTyped(raw);
}

function groupIndian(digits: string): string {
	if (digits.length <= 3) return digits;
	let head = digits.slice(0, -3);
	const tail = digits.slice(-3);
	const groups: string[] = [];
	while (head.length > 2) {
		groups.unshift(head.slice(-2));
		head = head.slice(0, -2);
	}
	if (head !== '') groups.unshift(head);
	return `${groups.join(',')},${tail}`;
}

/** Multiplies by basis points (2720 = 27.20%), rounding half away from zero. */
export function mulBP(p: Paise, bp: number): Paise {
	if (!Number.isInteger(p) || !Number.isInteger(bp))
		throw new Error(`mulBP expects integers, got ${p}, ${bp}`);
	const product = p * bp;
	if (!Number.isSafeInteger(product)) throw new Error(`mulBP overflow: ${p} × ${bp}`);
	const quotient = Math.trunc(product / 10000);
	const remainder = Math.abs(product % 10000);
	if (2 * remainder >= 10000) return product < 0 ? quotient - 1 : quotient + 1;
	return quotient;
}

/**
 * Parses a non-negative percentage like "27.20" into basis points (2720).
 *
 * Rejections are phrased as percentages, not as money. `parseMoney` does the
 * work — the two share a scale, two decimals to an integer ×100 — but its
 * wording says "amount", which is wrong on a field asking for a percent and is
 * a lowercase fragment where every other message a form shows is a sentence.
 * Its text is demoted to the `cause`, the way the SQLite wrappers demote
 * constraint text, so nothing is lost for a developer reading a stack trace.
 */
export function parsePercentBP(s: string): number {
	const text = s.trim();
	if (text === '') throw new Error('Enter a percentage like 27.20.');

	let bp: number;
	try {
		bp = parseMoney(text);
	} catch (err) {
		throw new Error(`Enter a percentage like 27.20 (got "${text}").`, { cause: err });
	}

	if (bp < 0) throw new Error(`A percentage cannot be negative (got "${text}").`);
	return bp;
}

/** Renders basis points as a percentage: 2720 → "27.20%". */
export function formatBP(bp: number): string {
	const sign = bp < 0 ? '-' : '';
	const abs = Math.abs(bp);
	return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}%`;
}
