/**
 * Chart geometry, pure. Figures arrive as paise and leave as percentages of a
 * plot box, so a chart lays out with CSS and fits any width without measuring
 * anything — the server renders the same picture the browser keeps.
 *
 * Nothing here is money arithmetic. A position is presentation; every figure a
 * chart prints still goes through `format.ts`.
 */

export interface Scale {
	/** The axis top: the smallest tick at or above the largest value. */
	top: number;
	/** 0, then one tick per step up to `top`. */
	ticks: number[];
}

/**
 * A zero-based axis whose ticks land on 1, 2, 2.5 or 5 × 10ⁿ. `count` is the
 * number of intervals wanted; the result has at most that many. An empty or
 * all-zero series still gets an axis, so a chart never divides by zero.
 */
export function niceScale(max: number, count = 4): Scale {
	if (!(max > 0)) return { top: 1, ticks: [0, 1] };
	const raw = max / count;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= raw) ?? raw;
	const steps = Math.ceil(max / step);
	return {
		top: steps * step,
		ticks: Array.from({ length: steps + 1 }, (_, i) => i * step)
	};
}

/** `value` as a percentage of `top`, held inside the plot. */
export function pct(value: number, top: number): number {
	if (!(top > 0)) return 0;
	return Math.min(100, Math.max(0, (value / top) * 100));
}

/**
 * Running totals by day: index 0 is the start of the month (nothing yet), index
 * d is everything through day d. Days with no entry carry the previous total.
 */
export function cumulative(byDay: Map<number, number>, days: number): number[] {
	const out = [0];
	for (let d = 1; d <= days; d++) out.push(out[d - 1] + (byDay.get(d) ?? 0));
	return out;
}

/**
 * An SVG path through points given as percentages of the plot — x from the
 * left, y from the bottom — for a `viewBox="0 0 100 100"` drawn with
 * `preserveAspectRatio="none"` and a non-scaling stroke.
 */
export function linePath(points: [x: number, y: number][]): string {
	return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(100 - y)}`).join('');
}

/** The same line closed down to the baseline, for a wash under it. */
export function areaPath(points: [x: number, y: number][]): string {
	if (points.length === 0) return '';
	const first = points[0];
	const last = points[points.length - 1];
	return `${linePath(points)}L${round(last[0])} 100L${round(first[0])} 100Z`;
}

function round(n: number): number {
	return Math.round(n * 100) / 100;
}
