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

/** Parses a non-negative percentage like "27.20" into basis points (2720). */
export function parsePercentBP(s: string): number {
	const bp = parseMoney(s); // same scale: two decimals → integer ×100
	if (bp < 0) throw new Error(`percentage "${s}" must not be negative`);
	return bp;
}

/** Renders basis points as a percentage: 2720 → "27.20%". */
export function formatBP(bp: number): string {
	const sign = bp < 0 ? '-' : '';
	const abs = Math.abs(bp);
	return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}%`;
}
