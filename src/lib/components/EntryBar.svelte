<!--
  The ledger's entry bar: the add form as one toolbar row above the table it
  feeds, for a run of entries without leaving the keyboard — after each add the
  amount field takes focus again. On a phone the add sheet is the form, so this
  shows only when linked to (#new, the no-script path of the add tab) or when a
  submit failed.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { Category, CategoryScope } from '$lib/server/categories';
	import type { Bucket, Direction, Source } from '$lib/server/ledger';
	import Icon from './Icon.svelte';
	import Notice from './Notice.svelte';

	const SCOPE_NAMES: Record<string, string> = {
		needs: 'Needs',
		wants: 'Wants',
		investments: 'Investments',
		job: 'Job',
		side_hustle: 'Side hustle',
		other: 'Other'
	};

	let {
		action,
		entry,
		values,
		error
	}: {
		action: string;
		entry: { today: string; categories: Category[] };
		values?: Record<string, string>;
		/** The failed submission's message, announced and tied to the amount field. */
		error?: string;
	} = $props();

	let amountInput: HTMLInputElement | undefined = $state();
	/** A second Enter while the first add is in flight would post it twice. */
	let busy = $state(false);

	/** Seeded once from the last submission, then owned by the controls. */
	const posted = untrack(() => values) ?? {};
	let direction = $state<Direction>((posted.direction as Direction) ?? 'outflow');
	let bucket = $state<Bucket>((posted.bucket as Bucket) ?? 'needs');
	let source = $state<Source>((posted.source as Source) ?? 'job');

	/** A category belongs to one bucket or source: the answer just given decides the list. */
	const scope = $derived<CategoryScope>(direction === 'income' ? source : bucket);
	const options = $derived(entry.categories.filter((c) => c.scope === scope));

	/**
	 * Script narrows the list as the bucket changes. Without it nothing would,
	 * so until the page runs every category is offered, grouped by what it
	 * belongs to — and the server still refuses a mismatched pair.
	 */
	let live = $state(false);
	onMount(() => (live = true));
	const groups = $derived(
		[...new Set(entry.categories.map((c) => c.scope))].map((s) => ({
			scope: s,
			label: SCOPE_NAMES[s] ?? s,
			categories: entry.categories.filter((c) => c.scope === s)
		}))
	);
</script>

<div class="entry-wrap" id="new" class:show={Boolean(error)}>
	<form
		class="entry"
		method="POST"
		{action}
		use:enhance={({ cancel }) => {
			if (busy) {
				cancel();
				return;
			}
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
				amountInput?.focus();
			};
		}}
	>
		<div class="field f-date">
			<label for="e-date">Date</label>
			<input id="e-date" name="date" type="date" value={values?.date ?? entry.today} required />
		</div>
		<div class="field f-amount">
			<label for="e-amount">Amount</label>
			<span class="affix">
				<span class="pre" aria-hidden="true">₹</span>
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
			</span>
		</div>
		<!-- A labelled group rather than a fieldset: a legend will not sit on the
		     toolbar's label line. -->
		<div class="field f-direction" role="radiogroup" aria-labelledby="e-direction">
			<span class="label" id="e-direction">Direction</span>
			<div class="seg">
				<label>
					<input type="radio" name="direction" value="outflow" bind:group={direction} />
					<span>Out</span>
				</label>
				<label>
					<input type="radio" name="direction" value="income" bind:group={direction} />
					<span>In</span>
				</label>
			</div>
		</div>
		<!-- Script swaps bucket for source as the direction changes; without it
		     both stay, and the server reads the one the direction names. -->
		{#if !live || direction === 'outflow'}
			<div class="field f-scope">
				<label for="e-bucket">Bucket</label>
				<select id="e-bucket" name="bucket" bind:value={bucket}>
					<option value="needs">Needs</option>
					<option value="wants">Wants</option>
					<option value="investments">Investments</option>
				</select>
			</div>
		{/if}
		{#if !live || direction === 'income'}
			<div class="field f-scope">
				<label for="e-source">Source</label>
				<!-- Only the two sources every rollup counts; `other` stays for imports. -->
				<select id="e-source" name="source" bind:value={source}>
					<option value="job">Job</option>
					<option value="side_hustle">Side hustle</option>
				</select>
			</div>
		{/if}
		<div class="field f-category">
			<label for="e-category">Category</label>
			<select id="e-category" name="category" required>
				{#if live}
					{#each options as c (c.id)}
						<option value={c.id} selected={values?.category === String(c.id)}>{c.name}</option>
					{:else}
						<option value="" disabled selected>—</option>
					{/each}
				{:else}
					{#each groups as g (g.scope)}
						<optgroup label={g.label}>
							{#each g.categories as c (c.id)}
								<option value={c.id} selected={values?.category === String(c.id)}>{c.name}</option>
							{/each}
						</optgroup>
					{/each}
				{/if}
			</select>
		</div>
		<div class="field f-note">
			<label for="e-note">Note</label>
			<input id="e-note" name="note" value={values?.note ?? ''} autocomplete="off" />
		</div>
		<button class="btn primary f-submit" type="submit" disabled={busy}>
			<Icon name="plus" />Add
		</button>
	</form>
	{#if live && !options.length}
		<div class="entry-msg">
			<Notice tone="warn">
				Nothing to file this under yet — <a href="/settings/categories">add a category</a>.
			</Notice>
		</div>
	{/if}
	{#if error}<p class="error entry-msg" id="e-error" role="alert">{error}</p>{/if}
</div>
