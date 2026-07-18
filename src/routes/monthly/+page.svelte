<script lang="ts">
	import { monthLabel, nextMonth, prevMonth } from '$lib/dates';
	import { formatBP, formatMoney } from '$lib/money';

	let { data } = $props();

	const s = $derived(data.summary);
	const prev = $derived(prevMonth(s.year, s.month));
	const next = $derived(nextMonth(s.year, s.month));
</script>

<svelte:head>
	<title>Monthly — Freyr</title>
</svelte:head>

<h1>Monthly budget</h1>

<div class="toolbar">
	<a href="/monthly?year={prev.year}&month={prev.month}">← {monthLabel(prev.year, prev.month)}</a>
	<strong>{monthLabel(s.year, s.month)}</strong>
	<a href="/monthly?year={next.year}&month={next.month}">{monthLabel(next.year, next.month)} →</a>
</div>

<div class="cards">
	<div class="card">
		<div class="label">Income</div>
		<div class="value">{formatMoney(s.income)}</div>
	</div>
</div>

{#if !s.period}
	<p class="notice">
		No budget period covers this month yet — set one in
		<a href="/settings/budget">Budget settings</a>.
	</p>
{/if}

<table>
	<thead>
		<tr>
			<th>Bucket</th>
			<th class="num">%</th>
			<th class="num">Allocated</th>
			<th class="num">Actual</th>
			<th class="num">Remaining</th>
		</tr>
	</thead>
	<tbody>
		{#each s.rows as row (row.bucket)}
			<tr>
				<td>{row.label}</td>
				<td class="num muted">{row.bp == null ? '—' : formatBP(row.bp)}</td>
				<td class="num">{row.allocated == null ? '—' : formatMoney(row.allocated)}</td>
				<td class="num">{formatMoney(row.actual)}</td>
				<td class="num {row.remaining == null ? '' : row.remaining < 0 ? 'neg' : 'pos'}">
					{row.remaining == null ? '—' : formatMoney(row.remaining)}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
