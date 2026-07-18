<script lang="ts">
	import { MONTH_NAMES } from '$lib/dates';
	import { formatMoney } from '$lib/money';

	let { data } = $props();
</script>

<svelte:head>
	<title>Yearly — Freyr</title>
</svelte:head>

<h1>Yearly rollup</h1>

<form class="toolbar" method="GET">
	<select name="year" onchange={(e) => e.currentTarget.form?.submit()} aria-label="Year">
		{#each data.years as y (y)}
			<option value={y} selected={data.year === y}>{y}</option>
		{/each}
	</select>
	<noscript><button type="submit">Show</button></noscript>
</form>

<div class="cards">
	<div class="card">
		<div class="label">Job income</div>
		<div class="value">{formatMoney(data.summary.job)}</div>
	</div>
	<div class="card">
		<div class="label">Side hustle</div>
		<div class="value">{formatMoney(data.summary.sideHustle)}</div>
	</div>
	<div class="card">
		<div class="label">Needs</div>
		<div class="value">{formatMoney(data.summary.needs)}</div>
	</div>
	<div class="card">
		<div class="label">Wants</div>
		<div class="value">{formatMoney(data.summary.wants)}</div>
	</div>
	<div class="card">
		<div class="label">Investments</div>
		<div class="value">{formatMoney(data.summary.invest)}</div>
	</div>
</div>

<h2>By month</h2>
<table>
	<thead>
		<tr>
			<th>Month</th>
			<th class="num">Income</th>
			<th class="num">Needs</th>
			<th class="num">Wants</th>
			<th class="num">Investments</th>
		</tr>
	</thead>
	<tbody>
		{#each data.months as m (m.month)}
			<tr>
				<td><a href="/monthly?year={data.year}&month={m.month}">{MONTH_NAMES[m.month - 1]}</a></td>
				<td class="num">{formatMoney(m.actuals.income)}</td>
				<td class="num">{formatMoney(m.actuals.needs)}</td>
				<td class="num">{formatMoney(m.actuals.wants)}</td>
				<td class="num">{formatMoney(m.actuals.invest)}</td>
			</tr>
		{:else}
			<tr><td colspan="5" class="muted">No transactions in {data.year}.</td></tr>
		{/each}
	</tbody>
</table>
