<script lang="ts">
	import { monthLabel } from '$lib/dates';
	import { formatMoney } from '$lib/money';
	import { meter } from '$lib/progress';

	let { data } = $props();

	const s = $derived(data.summary);
</script>

<svelte:head>
	<title>Home — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>{monthLabel(s.year, s.month)}</h1>
	<span class="muted">This month so far</span>
</div>

<div class="kpis">
	<div class="kpi">
		<div class="label">Income</div>
		<div class="value pos">{formatMoney(s.income)}</div>
	</div>
	<div class="kpi">
		<div class="label">Spent</div>
		<div class="value">{formatMoney(s.rows.reduce((t, r) => t + r.actual, 0))}</div>
	</div>
	<div class="kpi">
		<div class="label">Open lendings</div>
		<div class="value">{formatMoney(data.lendingsOutstanding)}</div>
	</div>
</div>

<h2>Budget</h2>
{#if !s.period}
	<p class="notice">
		No budget period covers this month — set one in <a href="/settings/budget">Budget settings</a>.
	</p>
{/if}
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Bucket</th>
				<th scope="col">Used</th>
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

<h2>Goals</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Goal</th>
				<th scope="col">Progress</th>
				<th scope="col" class="num">Saved</th>
				<th scope="col" class="num">Target</th>
				<th scope="col" class="num">%</th>
			</tr>
		</thead>
		<tbody>
			{#each data.goals as g (g.goal.id)}
				{@const m = meter(g.contributed, g.goal.targetPaise)}
				<tr>
					<td data-label="Goal">
						{g.goal.name}
						{#if g.goal.kind === 'pot'}<span class="tag">pot</span>{/if}
					</td>
					<td data-label="Progress">
						{#if m}
							<span class="meter"><span style="width:{m.width}%"></span></span>
						{:else}
							<span class="faint">—</span>
						{/if}
					</td>
					<td data-label="Saved" class="num amount">{formatMoney(g.contributed)}</td>
					<td data-label="Target" class="num amount">
						{g.goal.targetPaise ? formatMoney(g.goal.targetPaise) : '—'}
					</td>
					<td data-label="%" class="num">{m ? `${m.pct}%` : '—'}</td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="5">No goals yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
