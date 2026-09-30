/**
 * Presentation rules for figures. Pure — no DOM, no server imports.
 *
 * These two rules are mandated by DESIGN.md and were previously re-derived at
 * every call site, which is how `₹0.00` ended up shipping on the yearly page.
 * Keeping them here means a page cannot get them wrong by omission.
 */

import { formatMoney, type Paise } from './money';

/**
 * Structurally identical to `Direction` in `$lib/server/ledger`, declared here
 * because `$lib/server/*` may not be imported into code that reaches the client.
 */
export type Flow = 'income' | 'outflow';

export interface DeltaView {
	klass: 'pos' | 'neg' | 'flat';
	arrow: '▲' | '▼' | '—';
	text: string;
}

/**
 * A money figure for a table cell. Zero renders as an em dash — "nothing here"
 * reads far faster than a zero in a dense column. Inflows carry an explicit
 * plus; outflows render bare (DESIGN.md § Figures).
 */
export function formatCell(p: Paise, direction?: Flow): string {
	if (p === 0) return '—';
	if (direction === 'income' && p > 0) return `+${formatMoney(p)}`;
	return formatMoney(p);
}

/**
 * The Indian compact units, largest first, in paise. A lakh is 1,00,000 and a
 * crore 1,00,00,000; the steps between them are a hundredfold, which is what
 * lets `formatCompact` promote a figure that rounds up to the next unit.
 */
const COMPACT_UNITS: [paise: number, suffix: string][] = [
	[1_00_00_000_00, 'Cr'],
	[1_00_000_00, 'L'],
	[1_000_00, 'K']
];

/**
 * A short figure for chart axes and tight labels, in the Indian system: ₹950,
 * ₹9.5K, ₹95K, ₹9.5L, ₹95L, ₹9.5Cr. One decimal, dropped when it is zero.
 *
 * Rounds half up to a tenth of the unit (below a thousand, to the rupee). It
 * divides only to produce a label: the result is text, and nothing reads a
 * figure back out of it. A value that rounds up to a hundred of one unit is
 * printed in the next — 99,960 is ₹1L, not ₹100K.
 */
export function formatCompact(p: Paise): string {
	const sign = p < 0 ? '-' : '';
	const abs = Math.abs(p);
	// Math.round is the rounding rule throughout: half up, to the precision shown.
	const rupees = Math.round(abs / 100);
	if (rupees < 1000) return `${sign}₹${rupees}`;

	let i = COMPACT_UNITS.findIndex(([unit]) => abs >= unit);
	// Under a thousand exact but rounding to one: the smallest unit takes it.
	if (i === -1) i = COMPACT_UNITS.length - 1;
	let tenths = Math.round(abs / (COMPACT_UNITS[i][0] / 10));
	if (tenths >= 1000 && i > 0) {
		i -= 1;
		tenths = Math.round(abs / (COMPACT_UNITS[i][0] / 10));
	}
	return `${sign}₹${tenthsText(tenths)}${COMPACT_UNITS[i][1]}`;
}

function tenthsText(tenths: number): string {
	const whole = Math.trunc(tenths / 10);
	const frac = tenths % 10;
	return frac === 0 ? String(whole) : `${whole}.${frac}`;
}

/**
 * A share as a whole percentage for a label: 32%. Rounds half up; anything that
 * rounds to nothing but is not nothing reads "<1%", so a sliver never claims
 * to be zero. An empty whole has no share and prints an em dash.
 */
export function share(part: number, whole: number): string {
	if (whole <= 0) return '—';
	const pct = Math.round((part * 100) / whole);
	return pct === 0 && part > 0 ? '<1%' : `${pct}%`;
}

/**
 * A signed change across three redundant channels — arrow, color class and an
 * explicit sign — so the meaning survives color blindness and grayscale.
 *
 * The arrow and the class are independent. The arrow always reports the
 * direction of the number: ▲ when it rose. The class reports whether that is
 * good news, which depends on the figure — spending more is bad, having more
 * left is good. `lowerIsBetter` inverts the class only, never the arrow.
 */
export function delta(
	current: Paise,
	previous: Paise,
	opts?: { lowerIsBetter?: boolean }
): DeltaView {
	const diff = current - previous;
	if (diff === 0) return { klass: 'flat', arrow: '—', text: '—' };

	const rose = diff > 0;
	const good = opts?.lowerIsBetter ? !rose : rose;

	return {
		klass: good ? 'pos' : 'neg',
		arrow: rose ? '▲' : '▼',
		text: rose ? `+${formatMoney(diff)}` : formatMoney(diff)
	};
}
