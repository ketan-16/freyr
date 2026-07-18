<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatBP } from '$lib/money';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Budget settings — Freyr</title>
</svelte:head>

<h1>Budget periods</h1>

<form class="row entry" method="POST" use:enhance>
	<div>
		<label for="b-from">Effective from</label>
		<input
			id="b-from"
			name="effective_from"
			type="date"
			value={form?.values?.effective_from ?? data.today}
			required
		/>
	</div>
	<div>
		<label for="b-needs">Needs %</label>
		<input
			id="b-needs"
			name="needs"
			value={form?.values?.needs ?? ''}
			inputmode="decimal"
			required
		/>
	</div>
	<div>
		<label for="b-wants">Wants %</label>
		<input
			id="b-wants"
			name="wants"
			value={form?.values?.wants ?? ''}
			inputmode="decimal"
			required
		/>
	</div>
	<div>
		<label for="b-invest">Invest %</label>
		<input
			id="b-invest"
			name="invest"
			value={form?.values?.invest ?? ''}
			inputmode="decimal"
			required
		/>
	</div>
	<button class="primary" type="submit">Add period</button>
</form>
{#if form?.error}<p class="error">{form.error}</p>{/if}

<table>
	<thead>
		<tr>
			<th>Effective from</th>
			<th class="num">Needs</th>
			<th class="num">Wants</th>
			<th class="num">Invest</th>
			<th></th>
		</tr>
	</thead>
	<tbody>
		{#each data.periods as p (p.id)}
			<tr>
				<td>{p.effectiveFrom}</td>
				<td class="num">{formatBP(p.needsBP)}</td>
				<td class="num">{formatBP(p.wantsBP)}</td>
				<td class="num">{formatBP(p.investBP)}</td>
				<td
					>{#if p.id === data.activeId}<span class="pos">active</span>{/if}</td
				>
			</tr>
		{:else}
			<tr><td colspan="5" class="muted">No budget periods yet.</td></tr>
		{/each}
	</tbody>
</table>

<style>
	.entry {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.5rem 0.625rem;
		margin-bottom: 0.75rem;
	}
	.entry input {
		width: 6.5rem;
	}
	.entry input[type='date'] {
		width: 8.5rem;
	}
</style>
