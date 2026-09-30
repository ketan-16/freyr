<script lang="ts">
	import Bullet from '$lib/components/Bullet.svelte';
	import Delta from '$lib/components/Delta.svelte';
	import Kpi from '$lib/components/Kpi.svelte';
	import Money from '$lib/components/Money.svelte';
	import MonthChart from '$lib/components/MonthChart.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Ranks from '$lib/components/Ranks.svelte';
	import ShareBar from '$lib/components/ShareBar.svelte';
	import Stepper from '$lib/components/Stepper.svelte';
	import { MONTH_NAMES } from '$lib/dates';
	import { share } from '$lib/format';
	import { formatBP, formatMoney } from '$lib/money';
	import { meter } from '$lib/progress';

	let { data } = $props();

	// Each headline is the sum of a table further down the page, so the tile and
	// the rows beneath it can never quote different figures.
	const income = $derived(data.summary.job + data.summary.sideHustle);
	const spent = $derived(data.allocation.rows.reduce((t, r) => t + r.actual, 0));
	const net = $derived(income - spent);
	const active = $derived(data.months.length);

	const uncovered = $derived(
		data.allocation.uncoveredMonths.map((m) => MONTH_NAMES[m - 1]).join(', ')
	);

	const link = (year: number) => `/yearly?year=${year}`;
	const i = $derived(data.years.indexOf(data.year));
	const prev = $derived(i > 0 ? data.years[i - 1] : null);
	const next = $derived(i >= 0 && i < data.years.length - 1 ? data.years[i + 1] : null);
</script>

<svelte:head>
	<title>Year {data.year} — Freyr</title>
</svelte:head>

<PageHeader title="Year" sub="Month by month, and the year's plan against it">
	<Stepper
		unit="year"
		label={String(data.year)}
		prev={prev == null ? null : { href: link(prev), label: String(prev) }}
		next={next == null ? null : { href: link(next), label: String(next) }}
	>
		{#snippet picker(close)}
			<div class="picker-grid">
				{#each data.years as y (y)}
					<a
						href={link(y)}
						aria-current={y === data.year ? 'true' : undefined}
						class:today={y === Number(data.today.slice(0, 4))}
						onclick={close}>{y}</a
					>
				{/each}
			</div>
		{/snippet}
	</Stepper>
</PageHeader>

<div class="page">
	<!--
	  One notice at most, in order of how much it explains: no period at all
	  accounts for every dash; with no income the allocation is zero whatever
	  the coverage; partial coverage is last.
	-->
	{#if data.allocation.coverage === 'none'}
		<Notice tone="warn">
			No budget period covers any month with activity in {data.year}, so there is no plan to measure
			the spending below against. Add one dated 1 January {data.year} or earlier in
			<a href="/settings/budget">Splits</a>.
		</Notice>
	{:else if data.awaitingIncome}
		<Notice>
			No income is booked in {data.year}, so there was nothing to allocate. The buckets below show
			what was spent; targets appear once income lands.
		</Notice>
	{:else if data.allocation.coverage === 'partial'}
		<Notice tone="warn">
			No budget period covers {uncovered}. Spending in
			{data.allocation.uncoveredMonths.length === 1 ? 'that month' : 'those months'} still counts toward
			Actual, but Allocated covers only the rest of the year — so Remaining can be understated and show
			an overspend that never happened. Backdate a period in
			<a href="/settings/budget">Splits</a> to cover the year.
		</Notice>
	{/if}

	<div class="kpis">
		<Kpi label="Income">
			<Money value={income} direction="income" />
			{#snippet foot()}
				<Delta current={income} previous={data.prior.income} label="vs {data.prior.label}" />
			{/snippet}
		</Kpi>
		<Kpi label="Spent">
			<Money value={spent} />
			{#snippet foot()}
				<Delta
					current={spent}
					previous={data.prior.spent}
					lowerIsBetter
					label="vs {data.prior.label}"
				/>
			{/snippet}
		</Kpi>
		<Kpi label="Net">
			<!-- A negative net carries its own minus; the colour reinforces it. -->
			{#if net === 0}<span class="faint">—</span>{:else}<span
					class:neg={net < 0}
					class:pos={net > 0}>{net > 0 ? '+' : ''}{formatMoney(net)}</span
				>{/if}
			{#snippet foot()}
				<span>
					{#if income === 0}No income booked{:else if net >= 0}{share(net, income)} of income kept{:else}{share(
							-net,
							income
						)} more than income{/if}
				</span>
			{/snippet}
		</Kpi>
		<Kpi label="Monthly spend">
			{#if active}{formatMoney(Math.round(spent / active / 100) * 100)}{:else}<span class="faint"
					>—</span
				>{/if}
			{#snippet foot()}
				<span>Average over {active} {active === 1 ? 'month' : 'months'} with activity</span>
			{/snippet}
		</Kpi>
	</div>

	<section class="panel" aria-labelledby="months-h">
		<div class="panel-h">
			<h2 id="months-h">By month</h2>
			<div class="legend" style:margin-left="auto">
				<span><i style:--c="var(--muted-series)"></i>Income</span>
				<span><i style:--c="var(--needs)"></i>Needs</span>
				<span><i style:--c="var(--wants)"></i>Wants</span>
				<span><i style:--c="var(--invest)"></i>Investments</span>
			</div>
		</div>
		<div class="panel-b">
			<MonthChart
				months={data.months}
				year={data.year}
				today={data.today}
				href={(m) => `/monthly?year=${data.year}&month=${m}`}
			/>
		</div>
	</section>

	<div class="grid">
		<section class="panel c7" aria-labelledby="alloc-h">
			<div class="panel-h ruled">
				<h2 id="alloc-h">Plan against actual</h2>
				<span class="meta">Allocated share is allocated ÷ income</span>
			</div>
			<div class="tbl-scroll">
				<table class="tbl">
					<thead>
						<tr>
							<th scope="col" class="first">Bucket</th>
							<th scope="col" class="grow"><span class="visually-hidden">Used</span></th>
							<th scope="col" class="num">Allocated</th>
							<th scope="col" class="num">Actual</th>
							<th scope="col" class="num">Remaining</th>
							<th scope="col" class="num last">Share</th>
						</tr>
					</thead>
					<tbody>
						{#each data.allocation.rows as row (row.bucket)}
							{@const m = data.awaitingIncome ? null : meter(row.actual, row.allocated)}
							<tr class={row.bucket}>
								<th scope="row" class="first"><span class="bk {row.bucket}">{row.label}</span></th>
								<td class="grow">
									<Bullet
										actual={row.actual}
										allocated={data.awaitingIncome ? null : row.allocated}
										size="thin"
									/>
								</td>
								<td class="num"><Money value={row.allocated ?? 0} /></td>
								<td class="num"><Money value={row.actual} /></td>
								<!--
								  The same figure, sign and component the monthly view uses. Before
								  income lands, or with no period, there is nothing left of anything.
								-->
								<td class="num" class:neg={!data.awaitingIncome && (row.remaining ?? 0) < 0}>
									{#if data.awaitingIncome}<span class="faint">—</span>{:else}<Money
											value={row.remaining ?? 0}
										/>{/if}
								</td>
								<td class="num last muted">
									{row.effectiveBP == null ? '—' : formatBP(row.effectiveBP)}
									{#if m}<span class="visually-hidden">, {m.pct}% used</span>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section class="panel c5" aria-labelledby="income-h">
			<div class="panel-h">
				<h2 id="income-h">Income split</h2>
				<span class="meta"><Money value={income} direction="income" /></span>
			</div>
			<div class="panel-b income-split">
				<ShareBar
					tall
					parts={[
						{ key: 'job', value: data.summary.job },
						{ key: 'side', value: data.summary.sideHustle }
					]}
					label="Job {share(data.summary.job, income)}, side hustle {share(
						data.summary.sideHustle,
						income
					)}"
				/>
				<dl class="facts">
					<div>
						<dt><i class="sw job"></i> Job</dt>
						<dd>
							<Money value={data.summary.job} direction="income" />
							<span class="muted">{share(data.summary.job, income)}</span>
						</dd>
					</div>
					<div>
						<dt><i class="sw side"></i> Side hustle</dt>
						<dd>
							<Money value={data.summary.sideHustle} direction="income" />
							<span class="muted">{share(data.summary.sideHustle, income)}</span>
						</dd>
					</div>
				</dl>
			</div>
		</section>
	</div>

	<div class="grid">
		<section class="panel c7" aria-labelledby="table-h">
			<div class="panel-h ruled">
				<h2 id="table-h">Month by month</h2>
			</div>
			<div class="tbl-scroll">
				<table class="tbl t-months">
					<thead>
						<tr>
							<th scope="col" class="first">Month</th>
							<th scope="col" class="num">Income</th>
							<th scope="col" class="num">Needs</th>
							<th scope="col" class="num">Wants</th>
							<th scope="col" class="num">Invest</th>
							<th scope="col" class="num last">Net</th>
						</tr>
					</thead>
					<tbody>
						{#each data.months as m (m.month)}
							{@const n = m.income - m.needs - m.wants - m.invest}
							<tr>
								<th scope="row" class="first">
									<a class="row-link" href="/monthly?year={data.year}&month={m.month}"
										>{MONTH_NAMES[m.month - 1]}</a
									>
								</th>
								<td class="num"><Money value={m.income} direction="income" /></td>
								<td class="num"><Money value={m.needs} /></td>
								<td class="num"><Money value={m.wants} /></td>
								<td class="num"><Money value={m.invest} /></td>
								<td class="num last" class:neg={n < 0}>{n === 0 ? '—' : formatMoney(n)}</td>
							</tr>
						{:else}
							<tr><td class="empty" colspan="6">No transactions in {data.year}.</td></tr>
						{/each}
					</tbody>
					{#if data.months.length > 1}
						<tfoot>
							<tr>
								<th scope="row" class="first">Total</th>
								<td class="num"><Money value={income} direction="income" /></td>
								<td class="num"><Money value={data.summary.needs} /></td>
								<td class="num"><Money value={data.summary.wants} /></td>
								<td class="num"><Money value={data.summary.invest} /></td>
								<td class="num last" class:neg={net < 0}>{formatMoney(net)}</td>
							</tr>
						</tfoot>
					{/if}
				</table>
			</div>
		</section>

		<section class="panel c5" aria-labelledby="ycats-h">
			<div class="panel-h ruled">
				<h2 id="ycats-h">Where it went</h2>
			</div>
			<Ranks
				rows={data.spendByCategory}
				limit={10}
				caption="Spending by category, {data.year}"
				empty="Nothing spent in {data.year}."
			/>
		</section>
	</div>
</div>
