<script lang="ts">
	import { MONTH_NAMES } from '$lib/dates';
	import { formatMoney } from '$lib/money';

	let { data } = $props();

	const income = $derived(data.summary.job + data.summary.sideHustle);
	const spent = $derived(data.summary.needs + data.summary.wants + data.summary.invest);
</script>

<svelte:head>
	<title>Yearly — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>Yearly rollup</h1>
	<form method="GET">
		<label class="visually-hidden" for="f-year">Year</label>
		<select id="f-year" name="year" onchange={(e) => e.currentTarget.form?.submit()}>
			{#each data.years as y (y)}
				<option value={y} selected={data.year === y}>{y}</option>
			{/each}
		</select>
		<noscript><button type="submit">Show</button></noscript>
	</form>
</div>

<div class="kpis">
	<div class="kpi">
		<div class="label">Income</div>
		<div class="value pos">{formatMoney(income)}</div>
	</div>
	<div class="kpi">
		<div class="label">Spent</div>
		<div class="value">{formatMoney(spent)}</div>
	</div>
	<div class="kpi">
		<div class="label">Net</div>
		<div class="value {income - spent < 0 ? 'neg' : ''}">{formatMoney(income - spent)}</div>
	</div>
</div>

<h2>Income</h2>
<div class="kpis">
	<div class="kpi">
		<div class="label">Job</div>
		<div class="value">{formatMoney(data.summary.job)}</div>
	</div>
	<div class="kpi">
		<div class="label">Side hustle</div>
		<div class="value">{formatMoney(data.summary.sideHustle)}</div>
	</div>
</div>

<h2>Spend by bucket</h2>
<div class="kpis">
	<div class="kpi">
		<div class="label">Needs</div>
		<div class="value">{formatMoney(data.summary.needs)}</div>
	</div>
	<div class="kpi">
		<div class="label">Wants</div>
		<div class="value">{formatMoney(data.summary.wants)}</div>
	</div>
	<div class="kpi">
		<div class="label">Investments</div>
		<div class="value">{formatMoney(data.summary.invest)}</div>
	</div>
</div>

<h2>By month</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Month</th>
				<th scope="col" class="num">Income</th>
				<th scope="col" class="num">Needs</th>
				<th scope="col" class="num">Wants</th>
				<th scope="col" class="num">Investments</th>
			</tr>
		</thead>
		<tbody>
			{#each data.months as m (m.month)}
				<tr>
					<td data-label="Month">
						<a href="/monthly?year={data.year}&month={m.month}">{MONTH_NAMES[m.month - 1]}</a>
					</td>
					<td data-label="Income" class="num amount pos">{formatMoney(m.actuals.income)}</td>
					<td data-label="Needs" class="num amount">{formatMoney(m.actuals.needs)}</td>
					<td data-label="Wants" class="num amount">{formatMoney(m.actuals.wants)}</td>
					<td data-label="Investments" class="num amount">{formatMoney(m.actuals.invest)}</td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="5">No transactions in {data.year}.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
