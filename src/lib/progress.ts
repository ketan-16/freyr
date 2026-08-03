/**
 * Progress-meter presentation. Purely a view concern — the bar is a glance, the
 * number beside it is the truth (DESIGN.md § progress-meter).
 *
 * Thresholds: under 80% of allocation the bar is brand green, 80–100% amber,
 * over 100% loss red. When over budget, the track is rescaled to the true
 * percentage, showing both the allocation and excess within the fixed width.
 */
export type Meter = {
	/** True percentage, unclamped and rounded to whole percent. */
	pct: number;
	/** Width of the spend-up-to-allocation segment, as a percent of the track. */
	width: number;
	/** Width of the excess segment past the cap; 0 at or under the cap. */
	overflow: number;
	/** Modifier class for the meter element. */
	klass: '' | 'warn' | 'over';
};

export function meter(actual: number, allocated: number | null | undefined): Meter | null {
	if (allocated == null || allocated <= 0) return null;

	const pct = Math.round((actual / allocated) * 100);

	if (pct <= 100) {
		const klass = pct >= 80 ? 'warn' : '';
		return { pct, width: Math.max(0, pct), overflow: 0, klass };
	}

	// Rescale the track to pct so the allocation and the excess both fit
	// inside it. The bar is a glance; the number beside it is the truth.
	const width = Math.round((100 / pct) * 100);
	return { pct, width, overflow: 100 - width, klass: 'over' };
}
