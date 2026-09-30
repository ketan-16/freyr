<!--
  Spending pace: the month's running total against last month's by the same
  day, with the allocation as a ceiling and the even pace to it as a dashed
  reference. The one series the chart is about is ink; the comparison is the
  de-emphasis grey. Hover or focus reads any day; ← → step through them.
-->
<script lang="ts">
	import { areaPath, cumulative, linePath, niceScale, pct } from '$lib/chart';
	import { MONTH_NAMES } from '$lib/dates';
	import { formatCompact } from '$lib/format';
	import { formatMoney, type Paise } from '$lib/money';
	import type { DayTotals } from '$lib/server/insights';

	let {
		daily,
		priorDaily,
		days,
		priorDays,
		today,
		allocated,
		year,
		month,
		priorLabel
	}: {
		daily: DayTotals[];
		priorDaily: DayTotals[];
		days: number;
		priorDays: number;
		/** Today's day of the month, when the month is in progress. */
		today: number | null;
		allocated: Paise | null;
		year: number;
		month: number;
		priorLabel: string;
	} = $props();

	const spend = (d: DayTotals) => d.needs + d.wants + d.invest;
	/**
	 * Where this month's line ends: today, or later when something is already
	 * booked for a later day (rent entered ahead, say) — so the line's last
	 * point is always the month's total, the figure the headline quotes.
	 */
	const upTo = $derived(
		Math.max(today ?? days, ...daily.filter((d) => spend(d) > 0).map((d) => Math.min(d.day, days)))
	);
	const cum = $derived(cumulative(new Map(daily.map((d) => [d.day, spend(d)])), days));
	const priorCum = $derived(
		cumulative(new Map(priorDaily.map((d) => [d.day, spend(d)])), priorDays)
	);
	const priorEnd = $derived(Math.min(priorDays, days));
	const scale = $derived(niceScale(Math.max(cum[upTo], priorCum[priorEnd], allocated ?? 0), 4));

	const x = (d: number) => (d / days) * 100;
	const y = (v: number) => pct(v, scale.top);

	const thisLine = $derived(
		Array.from({ length: upTo + 1 }, (_, d): [number, number] => [x(d), y(cum[d])])
	);
	const priorLine = $derived(
		Array.from({ length: priorEnd + 1 }, (_, d): [number, number] => [x(d), y(priorCum[d])])
	);
	const pace = $derived(
		allocated
			? linePath([
					[0, 0],
					[100, y(allocated)]
				])
			: ''
	);

	/**
	 * Day labels that never crowd: 1, 5, 10 … the month's last day, and today
	 * in a month in progress, which clears the labels either side of it.
	 */
	const ticks = $derived.by(() => {
		const base = [1, 5, 10, 15, 20, 25].filter((d) => d <= days - 3).concat(days);
		if (today == null || today >= days) return base.map((d) => ({ d, now: false }));
		return [
			...base.filter((d) => Math.abs(d - today) > 2).map((d) => ({ d, now: false })),
			{ d: today, now: true }
		].sort((a, b) => a.d - b.d);
	});

	// Guarded: a hand-typed ?month=13 must not take the page down.
	const short = $derived(MONTH_NAMES[month - 1]?.slice(0, 3) ?? '');
	const summary = $derived(
		`Spent ${formatMoney(cum[upTo])} through ${upTo} ${short}` +
			`, against ${formatMoney(priorCum[Math.min(upTo, priorDays)])} by the same day of ${priorLabel}` +
			(allocated ? `, of ${formatMoney(allocated)} allocated` : '') +
			'. Left and right arrow keys read each day.'
	);

	/** Nothing in either month and no allocation: an axis of zeros says nothing. */
	const empty = $derived(cum[upTo] === 0 && priorCum[priorEnd] === 0 && !allocated);

	let active = $state<number | null>(null);

	function fromPointer(e: PointerEvent): void {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const d = Math.round(((e.clientX - r.left) / r.width) * days);
		active = Math.min(days, Math.max(1, d));
	}

	function onkeydown(e: KeyboardEvent): void {
		const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
		if (step) {
			e.preventDefault();
			active = Math.min(days, Math.max(1, (active ?? upTo) + step));
		} else if (e.key === 'Home' || e.key === 'End') {
			e.preventDefault();
			active = e.key === 'Home' ? 1 : days;
		} else if (e.key === 'Escape') {
			active = null;
		}
	}
</script>

{#if empty}
	<p class="empty-note chart-empty">
		Nothing spent this month or last, so there is no pace to draw yet.
	</p>
{:else}
	<div class="chart pace">
		<!-- A focusable reading surface: ← → move the crosshair a day at a time. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="plot has-y"
			role="group"
			aria-roledescription="chart"
			aria-label={summary}
			tabindex="0"
			onfocus={() => (active ??= upTo)}
			onblur={() => (active = null)}
			{onkeydown}
		>
			{#each scale.ticks as t (t)}
				<div class="gridline" class:base={t === 0} style:bottom="{y(t)}%"></div>
				<span class="ytick" style:bottom="{y(t)}%">{t === 0 ? '0' : formatCompact(t)}</span>
			{/each}
			<div
				class="area"
				role="presentation"
				onpointermove={fromPointer}
				onpointerleave={() => (active = null)}
			>
				<svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
					{#if allocated}
						<path
							d={linePath([
								[0, y(allocated)],
								[100, y(allocated)]
							])}
							style="stroke: var(--line-strong); stroke-width: 1"
						/>
						<path class="ref" d={pace} style="stroke: var(--ink-3)" />
					{/if}
					<path d={linePath(priorLine)} style="stroke: var(--muted-series)" />
					<path class="area" d={areaPath(thisLine)} style="--c: var(--ink)" />
					<path d={linePath(thisLine)} style="stroke: var(--ink)" />
				</svg>
				<!-- After the lines, on its own surface, so a line crossing it never hides it. -->
				{#if allocated}
					<span class="ref-label" style:bottom="{y(allocated)}%">
						Allocated {formatCompact(allocated)}
					</span>
				{/if}

				{#if active == null}
					<span class="dot" style:left="{x(upTo)}%" style:top="{100 - y(cum[upTo])}%"></span>
					<span
						class="dot-label"
						class:end={x(upTo) > 85}
						style:left="{x(upTo)}%"
						style:top="{100 - y(cum[upTo])}%"
					>
						{formatCompact(cum[upTo])}
					</span>
				{:else}
					<div class="crosshair" style:left="{x(active)}%"></div>
					{#if active <= priorEnd}
						<span
							class="dot"
							style:--c="var(--muted-series)"
							style:left="{x(active)}%"
							style:top="{100 - y(priorCum[active])}%"
						></span>
					{/if}
					{#if active <= upTo}
						<span class="dot" style:left="{x(active)}%" style:top="{100 - y(cum[active])}%"></span>
					{/if}
					<div class="tip {x(active) > 55 ? 'left' : 'right'}" style:left="{x(active)}%">
						<div class="tip-title">{active} {short} {year}</div>
						{#if active <= upTo}
							<div class="tip-row" style:--c="var(--ink)">
								<i></i>This month<span class="v">{formatMoney(cum[active])}</span>
							</div>
						{/if}
						{#if active <= priorEnd}
							<div class="tip-row" style:--c="var(--muted-series)">
								<i></i>{priorLabel}<span class="v">{formatMoney(priorCum[active])}</span>
							</div>
						{/if}
						{#if allocated}
							<div class="tip-row" style:--c="var(--ink-3)">
								<i class="dash"></i>Even pace<span class="v">
									<!-- A reading, not a figure anything sums: rounded to the rupee. -->
									{formatMoney(Math.round((allocated * active) / days / 100) * 100)}
								</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
		<div class="xaxis has-y" aria-hidden="true">
			{#each ticks as t (t.d)}
				<span style:left="{x(t.d)}%" class:now={t.now}>{t.d}</span>
			{/each}
		</div>
	</div>
{/if}
