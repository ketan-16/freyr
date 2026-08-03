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
 * plus; outflows render bare (DESIGN.md § money-cell).
 */
export function formatCell(p: Paise, direction?: Flow): string {
	if (p === 0) return '—';
	if (direction === 'income' && p > 0) return `+${formatMoney(p)}`;
	return formatMoney(p);
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
