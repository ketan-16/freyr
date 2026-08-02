<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { monthLabel, nextMonth, prevMonth } from '$lib/dates';
	import { formatBP, formatMoney } from '$lib/money';
	import { meter } from '$lib/progress';

	let { data } = $props();

	const s = $derived(data.summary);
	const prev = $derived(prevMonth(s.year, s.month));
	const next = $derived(nextMonth(s.year, s.month));
	const spent = $derived(s.rows.reduce((t, r) => t + r.actual, 0));
</script>

<svelte:head>
	<title>Monthly — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>Monthly budget</h1>
</div>

<div class="toolbar">
	<div class="stepper">
		<a
			href="/monthly?year={prev.year}&month={prev.month}"
			aria-label="Previous month, {monthLabel(prev.year, prev.month)}"
		>
			<Icon name="left" />
		</a>
		<span class="current">{monthLabel(s.year, s.month)}</span>
		<a
			href="/monthly?year={next.year}&month={next.month}"
			aria-label="Next month, {monthLabel(next.year, next.month)}"
		>
			<Icon name="right" />
		</a>
	</div>
</div>

<div class="kpis">
	<div class="kpi">
		<div class="label">Income</div>
		<div class="value pos">{formatMoney(s.income)}</div>
	</div>
	<div class="kpi">
		<div class="label">Spent</div>
		<div class="value">{formatMoney(spent)}</div>
	</div>
	<div class="kpi">
		<div class="label">Left</div>
		<div class="value {s.income - spent < 0 ? 'neg' : ''}">{formatMoney(s.income - spent)}</div>
	</div>
</div>

{#if !s.period}
	<p class="notice">
		No budget period covers this month yet — set one in
		<a href="/settings/budget">Budget settings</a>.
	</p>
{/if}

<h2>By bucket</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Bucket</th>
				<th scope="col">Used</th>
				<th scope="col" class="num">Share</th>
				<th scope="col" class="num">Allocated</th>
				<th scope="col" class="num">Actual</th>
				<th scope="col" class="num">Remaining</th>
			</tr>
		</thead>
		<tbody>
			{#each s.rows as row (row.bucket)}
				{@const m = meter(row.actual, row.allocated)}
				<tr>
					<td data-label="Bucket">{row.label}</td>
					<td data-label="Used">
						{#if m}
							<span class="meter {m.klass}"><span style="width:{m.width}%"></span></span>
						{:else}
							<span class="faint">—</span>
						{/if}
					</td>
					<td data-label="Share" class="num muted">{row.bp == null ? '—' : formatBP(row.bp)}</td>
					<td data-label="Allocated" class="num amount">
						{row.allocated == null ? '—' : formatMoney(row.allocated)}
					</td>
					<td data-label="Actual" class="num amount">{formatMoney(row.actual)}</td>
					<td
						data-label="Remaining"
						class="num amount {row.remaining == null ? '' : row.remaining < 0 ? 'neg' : 'pos'}"
					>
						{row.remaining == null ? '—' : formatMoney(row.remaining)}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
