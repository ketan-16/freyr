<!--
  A month day by day: one column per day, stacked by bucket in the bucket hues,
  weekends on a faint band. Each column is its own hover and focus target (and
  a link to that day's rows when `href` is given), so the tooltip answers the
  keyboard exactly as it answers the pointer. `compact` drops the value axis
  for a strip above a table.
-->
<script lang="ts">
	import { niceScale, pct } from '$lib/chart';
	import { MONTH_NAMES, weekday, WEEKDAYS } from '$lib/dates';
	import { formatCompact } from '$lib/format';
	import { formatMoney } from '$lib/money';
	import type { DayTotals } from '$lib/server/insights';

	let {
		daily,
		year,
		month,
		days,
		today = null,
		href,
		compact = false
	}: {
		daily: DayTotals[];
		year: number;
		month: number;
		days: number;
		/** Today's day of the month when the month is in progress. */
		today?: number | null;
		href?: (day: number) => string;
		compact?: boolean;
	} = $props();

	const byDay = $derived(new Map(daily.map((d) => [d.day, d])));
	const cols = $derived(
		Array.from({ length: days }, (_, i) => {
			const day = i + 1;
			const d = byDay.get(day);
			const wd = weekday(year, month, day);
			return {
				day,
				wd,
				needs: d?.needs ?? 0,
				wants: d?.wants ?? 0,
				invest: d?.invest ?? 0,
				total: d ? d.needs + d.wants + d.invest : 0
			};
		})
	);
	const scale = $derived(niceScale(Math.max(0, ...cols.map((c) => c.total)), compact ? 2 : 3));
	// Guarded: a hand-typed ?month=13 must not take the page down.
	const short = $derived(MONTH_NAMES[month - 1]?.slice(0, 3) ?? '');
	const labelled = $derived(
		cols.filter((c) => c.day === 1 || c.day % 5 === 0 || c.day === days || c.day === today)
	);

	let active = $state<number | null>(null);
	const on = $derived(active != null ? cols[active - 1] : null);
	const onRows = $derived(
		on
			? [
					{ key: 'needs', name: 'Needs', v: on.needs },
					{ key: 'wants', name: 'Wants', v: on.wants },
					{ key: 'invest', name: 'Investments', v: on.invest }
				].filter((r) => r.v > 0)
			: []
	);
</script>

<div class="chart daily" class:compact>
	<div class="plot" class:has-y={!compact}>
		{#each scale.ticks as t (t)}
			{#if t === 0 || !compact}
				<div class="gridline" class:base={t === 0} style:bottom="{pct(t, scale.top)}%"></div>
			{/if}
			{#if !compact}
				<span class="ytick" style:bottom="{pct(t, scale.top)}%"
					>{t === 0 ? '0' : formatCompact(t)}</span
				>
			{/if}
		{/each}
		<div class="area">
			<div class="cols">
				{#each cols as c (c.day)}
					<svelte:element
						this={href ? 'a' : 'div'}
						href={href?.(c.day)}
						class="col"
						class:weekend={c.wd === 0 || c.wd === 6}
						class:on={active === c.day}
						aria-label="{WEEKDAYS[c.wd]} {c.day} {short}: {c.total
							? `${formatMoney(c.total)} spent`
							: 'nothing spent'}"
						role={href ? undefined : 'img'}
						onpointerenter={() => (active = c.day)}
						onpointerleave={() => (active = null)}
						onfocus={() => (active = c.day)}
						onblur={() => (active = null)}
					>
						{#if c.total > 0}
							<span class="stack" style:height="{pct(c.total, scale.top)}%">
								{#if c.needs}<span class="needs" style:flex-grow={c.needs}></span>{/if}
								{#if c.wants}<span class="wants" style:flex-grow={c.wants}></span>{/if}
								{#if c.invest}<span class="invest" style:flex-grow={c.invest}></span>{/if}
							</span>
						{/if}
					</svelte:element>
				{/each}
			</div>
			{#if on}
				{@const at = ((on.day - 0.5) / days) * 100}
				<div class="tip {at > 55 ? 'left' : 'right'}" style:left="{at}%">
					<div class="tip-title">{WEEKDAYS[on.wd]} {on.day} {short} {year}</div>
					{#if on.total}
						{#each onRows as r (r.key)}
							<div class="tip-row {r.key}">
								<i class="sq"></i>{r.name}<span class="v">{formatMoney(r.v)}</span>
							</div>
						{/each}
						<div class="tip-row total">Spent<span class="v">{formatMoney(on.total)}</span></div>
					{:else}
						<div class="tip-row">Nothing spent</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
	<div class="xaxis" class:has-y={!compact} aria-hidden="true">
		{#each labelled as c (c.day)}
			<span
				style:left="{((c.day - 0.5) / days) * 100}%"
				class:now={c.day === today}
				class:opt={c.day % 10 !== 0 && c.day !== 1 && c.day !== today}>{c.day}</span
			>
		{/each}
	</div>
</div>
