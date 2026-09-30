<!--
  A year month by month: income as a grey column (context) beside the month's
  outflow stacked by bucket (the subject), on one axis — never two. Each month
  is a link to its budget, so hover and keyboard focus read the same tooltip.
-->
<script lang="ts">
	import { niceScale, pct } from '$lib/chart';
	import { MONTH_NAMES } from '$lib/dates';
	import { formatCompact } from '$lib/format';
	import { formatMoney } from '$lib/money';
	import type { MonthActuals } from '$lib/server/ledger';

	let {
		months,
		year,
		today,
		href
	}: {
		months: MonthActuals[];
		year: number;
		today: string;
		href: (month: number) => string;
	} = $props();

	const nowYear = $derived(Number(today.slice(0, 4)));
	const nowMonth = $derived(Number(today.slice(5, 7)));
	const byMonth = $derived(new Map(months.map((m) => [m.month, m])));
	const cols = $derived(
		MONTH_NAMES.map((name, i) => {
			const m = byMonth.get(i + 1);
			const spent = m ? m.needs + m.wants + m.invest : 0;
			return {
				month: i + 1,
				name,
				income: m?.income ?? 0,
				needs: m?.needs ?? 0,
				wants: m?.wants ?? 0,
				invest: m?.invest ?? 0,
				spent,
				future: year > nowYear || (year === nowYear && i + 1 > nowMonth)
			};
		})
	);
	const scale = $derived(
		niceScale(Math.max(0, ...cols.map((c) => Math.max(c.income, c.spent))), 4)
	);

	let active = $state<number | null>(null);
	const on = $derived(active != null ? cols[active - 1] : null);
	const onRows = $derived(
		on
			? [
					{ key: 'needs', name: 'Needs', v: on.needs },
					{ key: 'wants', name: 'Wants', v: on.wants },
					{ key: 'invest', name: 'Investments', v: on.invest }
				]
			: []
	);
</script>

<div class="chart months" style:--plot-h="13rem">
	<div class="plot has-y">
		{#each scale.ticks as t (t)}
			<div class="gridline" class:base={t === 0} style:bottom="{pct(t, scale.top)}%"></div>
			<span class="ytick" style:bottom="{pct(t, scale.top)}%"
				>{t === 0 ? '0' : formatCompact(t)}</span
			>
		{/each}
		<div class="area">
			<div class="cols">
				{#each cols as c (c.month)}
					<a
						class="col"
						class:on={active === c.month}
						href={href(c.month)}
						aria-label="{c.name} {year}: income {formatMoney(c.income)}, spent {formatMoney(
							c.spent
						)}"
						onpointerenter={() => (active = c.month)}
						onpointerleave={() => (active = null)}
						onfocus={() => (active = c.month)}
						onblur={() => (active = null)}
					>
						{#if c.income > 0}
							<span class="stack narrow muted" style:height="{pct(c.income, scale.top)}%">
								<span style:flex-grow="1"></span>
							</span>
						{/if}
						{#if c.spent > 0}
							<span class="stack narrow" style:height="{pct(c.spent, scale.top)}%">
								{#if c.needs}<span class="needs" style:flex-grow={c.needs}></span>{/if}
								{#if c.wants}<span class="wants" style:flex-grow={c.wants}></span>{/if}
								{#if c.invest}<span class="invest" style:flex-grow={c.invest}></span>{/if}
							</span>
						{/if}
					</a>
				{/each}
			</div>
			{#if on}
				{@const at = ((on.month - 0.5) / 12) * 100}
				<div class="tip {at > 55 ? 'left' : 'right'}" style:left="{at}%">
					<div class="tip-title">{on.name} {year}</div>
					<div class="tip-row" style:--c="var(--muted-series)">
						<i class="sq"></i>Income<span class="v">{formatMoney(on.income)}</span>
					</div>
					{#each onRows as r (r.key)}
						<div class="tip-row {r.key}">
							<i class="sq"></i>{r.name}<span class="v">{formatMoney(r.v)}</span>
						</div>
					{/each}
					<div class="tip-row total">
						Net<span class="v" class:neg={on.income - on.spent < 0}
							>{formatMoney(on.income - on.spent)}</span
						>
					</div>
				</div>
			{/if}
		</div>
	</div>
	<div class="xaxis has-y" aria-hidden="true">
		{#each cols as c (c.month)}
			<span
				style:left="{((c.month - 0.5) / 12) * 100}%"
				class:now={year === nowYear && c.month === nowMonth}
				class:faint={c.future}>{c.name.slice(0, 3)}</span
			>
		{/each}
	</div>
</div>
