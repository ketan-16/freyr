<!--
  The transaction-add form. Shared by the ledger and the home command centre so
  the two cannot drift. It sits directly above the table it feeds, so a new row
  appears where the eye already is (DESIGN.md § entry-bar).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { Category, CategoryScope } from '$lib/server/categories';
	import type { Bucket, Direction, Source } from '$lib/server/ledger';

	let {
		action,
		entry,
		values,
		error
	}: {
		action: string;
		entry: { today: string; categories: Category[] };
		values?: Record<string, string>;
		/**
		 * The failed submission's message. It lives here rather than beside the
		 * bar on each page so it is announced and tied to the amount field from
		 * one place — `use:enhance` never reloads, so an unassociated message is
		 * silent to a screen reader.
		 */
		error?: string;
	} = $props();

	let amountInput: HTMLInputElement | undefined = $state();

	/**
	 * Seeded once from the last submission, then owned by the selects. It is
	 * read untracked because a later `values` must not move a control the user
	 * is looking at: with JS the failed submit leaves their answers on screen,
	 * and without it the server re-renders a fresh component that seeds here.
	 */
	const posted = untrack(() => values) ?? {};
	let direction = $state<Direction>((posted.direction as Direction) ?? 'outflow');
	let bucket = $state<Bucket>((posted.bucket as Bucket) ?? 'needs');
	let source = $state<Source>((posted.source as Source) ?? 'job');

	/**
	 * A category belongs to one bucket or one income source, so the answer just
	 * given decides the list. Every category ships with the page and the filter
	 * runs here: changing bucket re-narrows the dropdown with no round trip.
	 */
	const scope = $derived<CategoryScope>(direction === 'income' ? source : bucket);
	const options = $derived(entry.categories.filter((c) => c.scope === scope));
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
				aria-describedby={error ? 'e-error' : undefined}
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
				<select id="e-bucket" name="bucket" bind:value={bucket}>
					<option value="needs">Needs</option>
					<option value="wants">Wants</option>
					<option value="investments">Investments</option>
				</select>
			</div>
		{:else}
			<div class="field">
				<label for="e-source">Source</label>
				<!--
				  Only job and side_hustle here: every rollup — monthly allocation,
				  the yearly split — counts those two, so income booked as 'other'
				  would show green in the ledger while the month still read as
				  awaiting income. The enum keeps 'other' for imported rows; do not
				  offer it until the rollups count it.
				-->
				<select id="e-source" name="source" bind:value={source}>
					<option value="job">Job</option>
					<option value="side_hustle">Side hustle</option>
				</select>
			</div>
		{/if}
		<div class="field">
			<label for="e-category">Category</label>
			<!--
			  Required, and empty when the scope has no categories yet: the browser
			  blocks the submit on the placeholder, and the notice below says where
			  to add one.
			-->
			<select id="e-category" name="category" required>
				{#each options as c (c.id)}
					<option value={c.id} selected={values?.category === String(c.id)}>{c.name}</option>
				{:else}
					<option value="" disabled selected>—</option>
				{/each}
			</select>
		</div>
		<div class="field grow">
			<label for="e-note">Note</label>
			<input id="e-note" name="note" value={values?.note ?? ''} autocomplete="off" />
		</div>
		<button class="primary" type="submit">Add</button>
	</form>
	{#if !options.length}
		<p class="notice">
			Nothing to file this under yet — <a href="/settings/categories">add a category</a>.
		</p>
	{/if}
	<!--
	  Outside the flex form so it takes its own line, and announced on insertion:
	  the failed submit returns focus to the amount field, which describes itself
	  with this message.
	-->
	{#if error}<p class="error" id="e-error" role="alert">{error}</p>{/if}
</details>
