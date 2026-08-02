/**
 * Progress-meter presentation. Purely a view concern — the bar is a glance, the
 * number beside it is the truth (DESIGN.md § progress-meter).
 *
 * Thresholds: under 80% of allocation the bar is brand green, 80–100% amber,
 * over 100% loss red. `width` is clamped so an overspend cannot paint outside
 * its track; `pct` keeps the true, unclamped figure for the label.
 */
export type Meter = {
	/** True percentage, unclamped and rounded to whole percent. */
	pct: number;
	/** Bar width in percent, clamped to 0–100. */
	width: number;
	/** Modifier class for the meter element. */
	klass: '' | 'warn' | 'over';
};

export function meter(actual: number, allocated: number | null | undefined): Meter | null {
	if (allocated == null || allocated <= 0) return null;

	const pct = Math.round((actual / allocated) * 100);
	const klass = pct > 100 ? 'over' : pct >= 80 ? 'warn' : '';

	return { pct, width: Math.max(0, Math.min(100, pct)), klass };
}
