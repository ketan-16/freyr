<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatBP } from '$lib/money';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Budget settings — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>Budget periods</h1>
	<span class="muted">Shares must sum to 100%. The newest period covering a month wins.</span>
</div>

<details class="entry-wrap" open>
	<summary>Add a period</summary>
	<form class="entry" method="POST" use:enhance>
		<div class="field">
			<label for="b-from">Effective from</label>
			<input
				id="b-from"
				name="effective_from"
				type="date"
				value={form?.values?.effective_from ?? data.today}
				required
			/>
		</div>
		<div class="field">
			<label for="b-needs">Needs %</label>
			<input
				id="b-needs"
				class="money"
				name="needs"
				value={form?.values?.needs ?? ''}
				inputmode="decimal"
				required
			/>
		</div>
		<div class="field">
			<label for="b-wants">Wants %</label>
			<input
				id="b-wants"
				class="money"
				name="wants"
				value={form?.values?.wants ?? ''}
				inputmode="decimal"
				required
			/>
		</div>
		<div class="field">
			<label for="b-invest">Invest %</label>
			<input
				id="b-invest"
				class="money"
				name="invest"
				value={form?.values?.invest ?? ''}
				inputmode="decimal"
				required
			/>
		</div>
		<button class="primary" type="submit">Add period</button>
	</form>
</details>
{#if form?.error}<p class="error">{form.error}</p>{/if}

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Effective from</th>
				<th scope="col" class="num">Needs</th>
				<th scope="col" class="num">Wants</th>
				<th scope="col" class="num">Invest</th>
				<th scope="col">Status</th>
			</tr>
		</thead>
		<tbody>
			{#each data.periods as p (p.id)}
				<tr>
					<td data-label="Effective from" class="num">{p.effectiveFrom}</td>
					<td data-label="Needs" class="num">{formatBP(p.needsBP)}</td>
					<td data-label="Wants" class="num">{formatBP(p.wantsBP)}</td>
					<td data-label="Invest" class="num">{formatBP(p.investBP)}</td>
					<td data-label={p.id === data.activeId ? 'Status' : null}>
						{#if p.id === data.activeId}<span class="tag">active</span>{/if}
					</td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="5">No budget periods yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
