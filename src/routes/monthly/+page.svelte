<script lang="ts">
	import Bullet from '$lib/components/Bullet.svelte';
	import DailyChart from '$lib/components/DailyChart.svelte';
	import Delta from '$lib/components/Delta.svelte';
	import Kpi from '$lib/components/Kpi.svelte';
	import MonthNav from '$lib/components/MonthNav.svelte';
	import Money from '$lib/components/Money.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Ranks from '$lib/components/Ranks.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import { addMonths, daysInMonth, monthLabel, shortMonth } from '$lib/dates';
	import { share } from '$lib/format';
	import { formatBP, formatMoney } from '$lib/money';
	import { meter } from '$lib/progress';

	let { data } = $props();

	const s = $derived(data.summary);
	const spent = $derived(s.rows.reduce((t, r) => t + r.actual, 0));
	const allocated = $derived(s.rows.reduce((t, r) => t + (r.allocated ?? 0), 0));
	// One source for the tile and the cards beneath it, exactly as home folds it.
	const left = $derived(s.rows.reduce((t, r) => t + (r.remaining ?? 0), 0));
	/** Something to be "left" of: a period in force, and income for it to allocate. */
	const hasBasis = $derived(s.period != null && !data.awaitingIncome);
	const days = $derived(daysInMonth(s.year, s.month));
	const day = $derived(data.isCurrentMonth ? Number(data.today.slice(8, 10)) : null);
	/** How far through the month: the pace mark on every bullet. */
	const elapsed = $derived(day == null ? null : day / days);

	/** Six months ending at this one, zero-filled, per bucket. */
	const trend = $derived.by(() => {
		const by = new Map(data.trend.map((t) => [`${t.year}-${t.month}`, t]));
		return Array.from({ length: 6 }, (_, i) => {
			const at = addMonths(s.year, s.month, i - 5);
			const t = by.get(`${at.year}-${at.month}`);
			return {
				label: shortMonth(at.year, at.month),
				needs: t?.needs ?? 0,
				wants: t?.wants ?? 0,
				investments: t?.invest ?? 0
			};
		});
	});

	const link = (year: number, month: number) => `/monthly?year=${year}&month=${month}`;
</script>

<svelte:head>
	<title>Budget · {monthLabel(s.year, s.month)} — Freyr</title>
</svelte:head>

<PageHeader title="Budget" sub="Allocated against spent">
	<MonthNav year={s.year} month={s.month} today={data.today} href={link} />
</PageHeader>

<div class="page">
	{#if !s.period}
		<Notice tone="warn">
			No budget period covers this month yet — set one in <a href="/settings/budget">Splits</a>.
		</Notice>
	{:else if data.awaitingIncome}
		<Notice>
			No income is booked for {monthLabel(s.year, s.month)}, so there is nothing to allocate.
			Buckets show what was spent; targets appear once income lands.
		</Notice>
	{/if}

	<div class="kpis">
		<Kpi label="Income">
			<Money value={s.income} direction="income" />
			{#snippet foot()}
				<Delta current={s.income} previous={data.prior.income} label="vs {data.prior.label}" />
			{/snippet}
		</Kpi>
		<Kpi label="Allocated">
			{#if hasBasis}<Money value={allocated} />{:else}<span class="faint">—</span>{/if}
			{#snippet foot()}
				{#if s.period}
					<span
						>{formatBP(s.period.needsBP)} · {formatBP(s.period.wantsBP)} · {formatBP(
							s.period.investBP
						)}</span
					>
				{:else}<span>No split in force</span>{/if}
			{/snippet}
		</Kpi>
		<Kpi label="Spent">
			<Money value={spent} />
			{#snippet foot()}
				<Delta
					current={spent}
					previous={data.prior.spent}
					lowerIsBetter
					label="vs {data.prior.label}{data.isCurrentMonth ? ', same days' : ''}"
				/>
			{/snippet}
		</Kpi>
		<!--
		  With no period or no income there is nothing to be left of — every card's
		  remainder is a dash, and so is this.
		-->
		<Kpi label="Left">
			{#if hasBasis}
				<span class:neg={left < 0}>{formatMoney(left)}</span>
			{:else}<span class="faint">—</span>{/if}
			{#snippet foot()}
				{#if hasBasis}<span>{share(spent, allocated)} of the allocation used</span>{/if}
			{/snippet}
		</Kpi>
	</div>

	<section class="bucket-cols" aria-label="By bucket">
		{#each s.rows as row (row.bucket)}
			{@const m = hasBasis ? meter(row.actual, row.allocated) : null}
			<article class="panel bcard {row.bucket}" aria-labelledby="b-{row.bucket}">
				<div class="bcard-h">
					<h2 id="b-{row.bucket}"><i class="sw"></i>{row.label}</h2>
					<Sparkline
						values={trend.map((t) => t[row.bucket])}
						label="{row.label}, six months to {monthLabel(s.year, s.month)}"
					/>
				</div>
				<div class="bcard-fig">
					<span class="big"><Money value={row.actual} /></span>
					<span class="of">
						{#if hasBasis && row.allocated != null}of {formatMoney(row.allocated)}{:else}spent{/if}
					</span>
				</div>
				<Bullet
					actual={row.actual}
					allocated={hasBasis ? row.allocated : null}
					mark={elapsed}
					size="tall"
					label={m ? `${row.label}: ${m.pct}% of its allocation used` : undefined}
				/>
				<div class="bcard-row">
					<span>
						{#if m}{m.pct}% used{:else}—{/if}
						{#if row.bp != null}· {formatBP(row.bp)} share{/if}
					</span>
					<span>
						{#if hasBasis && row.remaining != null}
							{row.remaining < 0 ? 'Over' : 'Left'}
							<b class:neg={row.remaining < 0}>{formatMoney(Math.abs(row.remaining))}</b>
						{:else}Left <b class="faint">—</b>{/if}
					</span>
				</div>
				<p class="subhead">Categories</p>
				<Ranks
					rows={data.spendByCategory.filter((c) => c.bucket === row.bucket)}
					limit={5}
					caption="{row.label} by category"
					empty="Nothing in {row.label.toLowerCase()} yet."
				/>
			</article>
		{/each}
	</section>

	<section class="panel" aria-labelledby="daily-h">
		<div class="panel-h">
			<h2 id="daily-h">Day by day</h2>
			<div class="legend" style:margin-left="auto">
				<span><i style:--c="var(--needs)"></i>Needs</span>
				<span><i style:--c="var(--wants)"></i>Wants</span>
				<span><i style:--c="var(--invest)"></i>Investments</span>
			</div>
		</div>
		<div class="panel-b">
			<DailyChart
				daily={data.daily}
				year={s.year}
				month={s.month}
				{days}
				today={day}
				href={(d) => `/ledger?year=${s.year}&month=${s.month}#day-${d}`}
			/>
		</div>
	</section>
</div>
