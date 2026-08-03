<!--
  The transaction-add form. Shared by the ledger and the home command centre so
  the two cannot drift. It sits directly above the table it feeds, so a new row
  appears where the eye already is (DESIGN.md § entry-bar).
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Category } from '$lib/server/ledger';

	interface Named {
		id: number;
		name: string;
	}

	let {
		action,
		entry,
		values
	}: {
		action: string;
		entry: { today: string; categories: Category[]; goals: Named[]; locations: Named[] };
		values?: Record<string, string>;
	} = $props();

	let amountInput: HTMLInputElement | undefined = $state();
	let direction = $state('outflow');
</script>

<details class="entry-wrap" open>
	<summary>Add transaction</summary>
	<form
		class="entry"
		method="POST"
		{action}
		use:enhance={() =>
			async ({ update }) => {
				await update();
				amountInput?.focus();
			}}
	>
		<div class="field">
			<label for="e-date">Date</label>
			<input id="e-date" name="date" type="date" value={values?.date ?? entry.today} required />
		</div>
		<div class="field">
			<label for="e-amount">Amount ₹</label>
			<input
				id="e-amount"
				class="money"
				name="amount"
				bind:this={amountInput}
				value={values?.amount ?? ''}
				inputmode="decimal"
				autocomplete="off"
				required
			/>
		</div>
		<div class="field">
			<label for="e-direction">Direction</label>
			<select id="e-direction" name="direction" bind:value={direction}>
				<option value="outflow">Outflow</option>
				<option value="income">Income</option>
			</select>
		</div>
		{#if direction === 'outflow'}
			<div class="field">
				<label for="e-bucket">Bucket</label>
				<select id="e-bucket" name="bucket">
					<option value="needs">Needs</option>
					<option value="wants">Wants</option>
					<option value="investments">Investments</option>
				</select>
			</div>
			<div class="field">
				<label for="e-category">Category</label>
				<input id="e-category" name="category" list="categories" value={values?.category ?? ''} />
				<datalist id="categories">
					{#each entry.categories as c (c.id)}<option value={c.name}></option>{/each}
				</datalist>
			</div>
			<div class="field">
				<label for="e-goal">Goal</label>
				<select id="e-goal" name="goal">
					<option value="">—</option>
					{#each entry.goals as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="e-location">Location</label>
				<select id="e-location" name="location">
					<option value="">—</option>
					{#each entry.locations as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
				</select>
			</div>
		{:else}
			<div class="field">
				<label for="e-source">Source</label>
				<select id="e-source" name="source">
					<option value="job">Job</option>
					<option value="side_hustle">Side hustle</option>
					<option value="other">Other</option>
				</select>
			</div>
		{/if}
		<div class="field grow">
			<label for="e-note">Note</label>
			<input id="e-note" name="note" value={values?.note ?? ''} autocomplete="off" />
		</div>
		<button class="primary" type="submit">Add</button>
	</form>
</details>
