<!--
  The split over time: each budget period as a band from its effective date to
  the next, divided into the three bucket shares, with every raise marked on
  top. It shows what the raise policy does — each promotion pulls the weights
  toward the raise split. The periods table beneath is its table view, so the
  bands answer the pointer only.
-->
<script lang="ts">
	import { monthStart, shortDate } from '$lib/dates';
	import { formatBP } from '$lib/money';
	import type { Period } from '$lib/server/budgets';
	import type { PromotionEffect } from '$lib/server/promotions';

	let {
		periods,
		promotions,
		today
	}: { periods: Period[]; promotions: PromotionEffect[]; today: string } = $props();

	const dayNo = (iso: string) =>
		Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) /
		86_400_000;

	/**
	 * The periods in force, oldest first. `periods` arrives in the order
	 * `activeFor` resolves them — newest first, a manual row before a generated
	 * one on the same date — so the first at or before a date is the one in force.
	 */
	const segs = $derived.by(() => {
		const dates = [...new Set(periods.map((p) => p.effectiveFrom))].sort();
		return dates.map((from, i) => ({
			from,
			to: dates[i + 1] ?? null,
			p: periods.find((q) => q.effectiveFrom <= from)!
		}));
	});

	const start = $derived(segs[0]?.from ?? today);
	const end = $derived.by(() => {
		const lastYear = Math.max(
			Number(today.slice(0, 4)),
			Number((segs.at(-1)?.from ?? today).slice(0, 4))
		);
		return `${lastYear + 1}-01-01`;
	});
	const x = (iso: string) =>
		((dayNo(iso) - dayNo(start)) / Math.max(1, dayNo(end) - dayNo(start))) * 100;

	const years = $derived.by(() => {
		const out: number[] = [];
		for (let y = Number(start.slice(0, 4)) + 1; y < Number(end.slice(0, 4)); y++) out.push(y);
		return out;
	});

	const current = $derived(periods.find((p) => p.effectiveFrom <= today) ?? null);
	const summary = $derived(
		segs.length
			? `Budget split over time, from ${share(segs[0].p)} in ${shortDate(segs[0].from)}` +
					(current ? ` to ${share(current)} today` : '')
			: 'No budget periods yet'
	);

	function share(p: Period): string {
		return `${formatBP(p.needsBP)} needs, ${formatBP(p.wantsBP)} wants, ${formatBP(p.investBP)} investments`;
	}

	let active = $state<number | null>(null);
	const on = $derived(active != null ? segs[active] : null);
</script>

<div class="chart splits" style:--plot-h="8.5rem">
	<div class="plot" role="img" aria-label={summary}>
		<div class="bands" aria-hidden="true">
			{#each segs as s, i (s.from)}
				{@const left = x(s.from)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="band"
					class:on={active === i}
					style:left="{left}%"
					style:width="{x(s.to ?? end) - left}%"
					onpointerenter={() => (active = i)}
					onpointerleave={() => (active = null)}
				>
					<span class="needs" style:flex-grow={s.p.needsBP}></span>
					<span class="wants" style:flex-grow={s.p.wantsBP}></span>
					<span class="invest" style:flex-grow={s.p.investBP}></span>
				</div>
			{/each}
			{#each promotions as p (p.id)}
				<span class="marker" style:left="{x(monthStart(p.effectiveDate))}%">
					+{formatBP(p.incrementBP).replace('.00', '')}
				</span>
			{/each}
			{#if today >= start && today < end}
				<div class="crosshair now-line" style:left="{x(today)}%"></div>
			{/if}
		</div>
		{#if on}
			{@const at = x(on.from) + (x(on.to ?? end) - x(on.from)) / 2}
			<div class="tip {at > 55 ? 'left' : 'right'}" style:left="{at}%">
				<div class="tip-title">
					From {shortDate(on.from)} · {on.p.source}
				</div>
				<div class="tip-row needs">
					<i class="sq"></i>Needs<span class="v">{formatBP(on.p.needsBP)}</span>
				</div>
				<div class="tip-row wants">
					<i class="sq"></i>Wants<span class="v">{formatBP(on.p.wantsBP)}</span>
				</div>
				<div class="tip-row invest">
					<i class="sq"></i>Investments<span class="v">{formatBP(on.p.investBP)}</span>
				</div>
			</div>
		{/if}
	</div>
	<div class="xaxis" aria-hidden="true">
		{#each years as y (y)}
			<span style:left="{x(`${y}-01-01`)}%">{y}</span>
		{/each}
	</div>
</div>
