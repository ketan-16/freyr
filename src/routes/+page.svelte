<script lang="ts">
	import { monthLabel } from '$lib/dates';
	import { formatMoney } from '$lib/money';

	let { data } = $props();

	const s = $derived(data.summary);

	function pct(contributed: number, target: number | null): string {
		if (!target) return '';
		return `${((contributed / target) * 100).toFixed(1)}%`;
	}
</script>

<svelte:head>
	<title>Home — Freyr</title>
</svelte:head>

<h1>{monthLabel(s.year, s.month)}</h1>

<div class="cards">
	<div class="card">
		<div class="label">Income so far</div>
		<div class="value">{formatMoney(s.income)}</div>
	</div>
	<div class="card">
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
<table>
	<thead>
		<tr>
			<th>Bucket</th>
			<th class="num">Allocated</th>
			<th class="num">Actual</th>
			<th class="num">Remaining</th>
		</tr>
	</thead>
	<tbody>
		{#each s.rows as row (row.bucket)}
			<tr>
				<td>{row.label}</td>
				<td class="num">{row.allocated == null ? '—' : formatMoney(row.allocated)}</td>
				<td class="num">{formatMoney(row.actual)}</td>
				<td class="num {row.remaining == null ? '' : row.remaining < 0 ? 'neg' : 'pos'}">
					{row.remaining == null ? '—' : formatMoney(row.remaining)}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<h2>Goals</h2>
<table>
	<thead>
		<tr>
			<th>Goal</th>
			<th class="num">Saved</th>
			<th class="num">Target</th>
			<th class="num">Progress</th>
		</tr>
	</thead>
	<tbody>
		{#each data.goals as g (g.goal.id)}
			<tr>
				<td>{g.goal.name} <span class="faint">{g.goal.kind === 'pot' ? '(pot)' : ''}</span></td>
				<td class="num">{formatMoney(g.contributed)}</td>
				<td class="num">{g.goal.targetPaise ? formatMoney(g.goal.targetPaise) : '—'}</td>
				<td class="num">{pct(g.contributed, g.goal.targetPaise)}</td>
			</tr>
		{:else}
			<tr><td colspan="4" class="muted">No goals yet.</td></tr>
		{/each}
	</tbody>
</table>
