<!--
  The transaction form: direction, amount, where it belongs, a category, then
  date and note. Shared by the add/edit sheet and the edit page, so both are
  the same form under the same rules (the server holds the rules; this only
  asks the questions in the fastest order).

  With `onDone` it runs inside the sheet: a successful post refreshes the page
  underneath and reports back instead of navigating. Without it the form
  behaves like any enhanced form and follows the redirect.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { todayISO } from '$lib/dates';
	import { formatMoney, groupTyped, keyAmount, parseMoney, toAmountInput } from '$lib/money';
	import type { Category, CategoryScope } from '$lib/server/categories';
	import type { Bucket, Direction, Source, Txn } from '$lib/server/ledger';
	import Icon from './Icon.svelte';

	let {
		categories,
		txn = null,
		action,
		deleteAction,
		values,
		error: failed,
		remembered,
		onDone,
		onCancel,
		cancelHref,
		keypad = false,
		busy = $bindable(false)
	}: {
		categories: Category[];
		/** The row being edited; null when adding. */
		txn?: Txn | null;
		action: string;
		deleteAction?: string;
		/** What a failed no-JS post sent, so the form re-renders as typed. */
		values?: Record<string, string>;
		error?: string;
		/** The last add's answers, so a run of entries repeats fewer taps. */
		remembered?: Record<string, string>;
		onDone?: (message: string, answers: Record<string, string>) => void;
		onCancel?: () => void;
		cancelHref?: string;
		/** Offer the amount keypad on a phone (the sheet does; the edit page does not). */
		keypad?: boolean;
		/** True from submit until the result lands; the sheet will not close meanwhile. */
		busy?: boolean;
	} = $props();

	const uid = $props.id();

	/** Seeded once: later prop changes must not move a control the user is looking at. */
	const seed: Record<string, string> = untrack(
		() =>
			values ??
			(txn
				? {
						direction: txn.direction,
						bucket: txn.bucket ?? 'needs',
						source: txn.incomeSource ?? 'job',
						category: txn.categoryId == null ? '' : String(txn.categoryId),
						// Grouped for reading ("1,250.50"); parseMoney takes it back as is.
						amount: groupTyped(toAmountInput(txn.amountPaise)),
						date: txn.date,
						note: txn.note ?? ''
					}
				: (remembered ?? {}))
	);

	let direction = $state<Direction>((seed.direction as Direction) ?? 'outflow');
	let bucket = $state<Bucket>((seed.bucket as Bucket) ?? 'needs');
	let source = $state<Source>((seed.source as Source) ?? 'job');
	let category = $state(seed.category ?? '');
	let amount = $state(seed.amount ?? '');
	let date = $state(seed.date ?? todayISO());
	let note = $state(seed.note ?? '');
	let error = $state(untrack(() => failed) ?? '');
	let armed = $state(false);

	const linkedGoal = $derived(txn?.goalId != null);
	const linkedLending = $derived(txn?.lendingId != null);
	/**
	 * Income from `other` — a lending repayment — has no category anyone can
	 * pick (settings offers none for it), so it can be deleted but not edited.
	 */
	const readOnly = $derived(txn?.incomeSource === 'other');

	const scope = $derived<CategoryScope>(direction === 'income' ? source : bucket);
	/**
	 * The categories for the answer just given. An edited row keeps the one it
	 * was filed under even when that is archived since, while its scope holds.
	 */
	const options = $derived.by(() => {
		const list = categories.filter((c) => c.scope === scope);
		const own = txn?.categoryId;
		const ownScope = txn ? (txn.bucket ?? txn.incomeSource) : null;
		if (own != null && ownScope === scope && !list.some((c) => c.id === own))
			list.push({
				id: own,
				scope,
				name: `${txn?.categoryName ?? 'Category'} (archived)`,
				archived: true
			});
		return list;
	});
	/**
	 * Script narrows the chips as the answers change. Without it they could not,
	 * so until the page runs every category is offered, grouped by what it
	 * belongs to; the server still refuses a pair that does not match.
	 */
	let live = $state(false);
	/**
	 * A phone gets its own amount keypad. The system's decimal keypad has no
	 * return key and covers the rest of the sheet — bucket, category, the add
	 * button — so it would have to be dismissed before every entry could finish.
	 */
	let phone = $state(false);
	onMount(() => {
		live = true;
		const query = matchMedia('(pointer: coarse) and (max-width: 40rem)');
		phone = query.matches;
		const follow = () => (phone = query.matches);
		query.addEventListener('change', follow);
		return () => query.removeEventListener('change', follow);
	});
	const pad = $derived(keypad && phone && !readOnly);

	function press(key: string): void {
		amount = keyAmount(amount, key);
		error = '';
	}
	const SCOPE_NAMES: Record<string, string> = {
		needs: 'Needs',
		wants: 'Wants',
		investments: 'Investments',
		job: 'Job',
		side_hustle: 'Side hustle'
	};
	const everything = $derived.by(() => {
		const groups = [...new Set(categories.map((c) => c.scope))].map((s) => ({
			scope: s,
			label: SCOPE_NAMES[s] ?? s,
			list: categories.filter((c) => c.scope === s)
		}));
		// An edited row keeps an archived category it was filed under, here too.
		const own = txn?.categoryId;
		const ownScope = txn ? (txn.bucket ?? txn.incomeSource) : null;
		if (own != null && ownScope && !categories.some((c) => c.id === own)) {
			const entry = {
				id: own,
				scope: ownScope,
				name: `${txn?.categoryName ?? 'Category'} (archived)`,
				archived: true
			};
			const group = groups.find((g) => g.scope === ownScope);
			if (group) group.list.push(entry);
			else
				groups.push({ scope: ownScope, label: SCOPE_NAMES[ownScope] ?? ownScope, list: [entry] });
		}
		return groups;
	});

	/** The chosen category if it fits this scope; the only one if there is one. */
	const picked = $derived(
		options.some((c) => String(c.id) === category)
			? category
			: options.length === 1
				? String(options[0].id)
				: ''
	);

	function describe(): string {
		let rupees: string;
		try {
			rupees = formatMoney(parseMoney(amount));
		} catch {
			rupees = amount;
		}
		const name = options.find((c) => String(c.id) === picked)?.name;
		return name ? `${rupees} · ${name}` : rupees;
	}

	// A second Enter or tap while the first post is in flight is dropped: the
	// sheet stays open with the same values until the page has refreshed, and
	// without this guard that window posts the same entry twice.
	const submit: SubmitFunction = ({ cancel }) => {
		if (busy) {
			cancel();
			return;
		}
		busy = true;
		error = '';
		const summary = describe();
		// The date is not remembered: the next add is most likely today's.
		const answers = { direction, bucket, source, category: picked };
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				busy = false;
				error = String(result.data?.error ?? 'That did not save.');
				return;
			}
			if (result.type === 'error') {
				busy = false;
				error = result.error?.message ?? 'That did not save.';
				return;
			}
			if (result.type === 'redirect' && onDone) {
				// Still busy: the sheet closes on onDone, and nothing may post before.
				await invalidateAll();
				onDone(txn ? `Saved ${summary}` : `Added ${summary}`, answers);
				return;
			}
			await update();
			busy = false;
		};
	};

	const remove: SubmitFunction = ({ cancel }) => {
		if (busy) {
			cancel();
			return;
		}
		busy = true;
		return async ({ result, update }) => {
			if (result.type === 'redirect' && onDone) {
				await invalidateAll();
				onDone('Transaction deleted', {});
				return;
			}
			await update();
			busy = false;
		};
	};

	function confirmDelete(e: MouseEvent): void {
		// The first press arms it; script off, the button just submits.
		if (armed) return;
		e.preventDefault();
		armed = true;
		setTimeout(() => (armed = false), 4000);
	}
</script>

<form class="txn-form" method="POST" {action} use:enhance={submit}>
	{#if txn}<input type="hidden" name="id" value={txn.id} />{/if}
	<div class="sheet-b">
		<div class="seg fill" role="radiogroup" aria-label="Direction">
			<label>
				<input
					type="radio"
					name="direction"
					value="outflow"
					bind:group={direction}
					disabled={linkedLending || readOnly}
				/>
				<span><Icon name="arrow-up-right" size={14} />Outflow</span>
			</label>
			<label>
				<input
					type="radio"
					name="direction"
					value="income"
					bind:group={direction}
					disabled={linkedGoal || readOnly}
				/>
				<span><Icon name="arrow-down-left" size={14} />Income</span>
			</label>
		</div>

		<div class="field">
			<label for="{uid}-amount">Amount</label>
			<div class="amount-field" class:pad>
				<span class="cur" aria-hidden="true">₹</span>
				<!-- With the keypad, tapping the field must not raise the system keyboard. -->
				<input
					id="{uid}-amount"
					name="amount"
					bind:value={amount}
					inputmode={pad ? 'none' : 'decimal'}
					autocomplete="off"
					placeholder="0"
					required
					readonly={readOnly}
					aria-describedby={error ? `${uid}-err` : undefined}
					data-autofocus={pad ? undefined : ''}
				/>
			</div>
		</div>

		<!-- Script swaps bucket for source as the direction changes; without it
		     both stay, and the server reads the one the direction names. -->
		{#if !live || direction === 'outflow'}
			<div class="field" role="radiogroup" aria-labelledby="{uid}-bucket">
				<span class="label" id="{uid}-bucket">Bucket</span>
				<div class="seg fill">
					{#each [['needs', 'Needs'], ['wants', 'Wants'], ['investments', 'Investments']] as [value, name] (value)}
						<label>
							<input type="radio" name="bucket" {value} bind:group={bucket} />
							<span><i class="sw {value}"></i>{name}</span>
						</label>
					{/each}
				</div>
			</div>
		{/if}
		{#if !live || direction === 'income'}
			<div class="field" role="radiogroup" aria-labelledby="{uid}-source">
				<span class="label" id="{uid}-source">Source</span>
				<div class="seg fill">
					<!--
					  Only job and side hustle: every rollup counts those two, so income
					  booked as `other` would be invisible to allocations and totals.
					  The enum keeps `other` for imported repayments, shown read-only.
					-->
					{#each readOnly ? [['other', 'Other']] : [['job', 'Job'], ['side_hustle', 'Side hustle']] as [value, name] (value)}
						<label>
							<input type="radio" name="source" {value} bind:group={source} disabled={readOnly} />
							<span>{name}</span>
						</label>
					{/each}
				</div>
			</div>
		{/if}

		<div class="field" role="radiogroup" aria-labelledby="{uid}-category">
			<span class="label" id="{uid}-category">Category</span>
			{#if readOnly}
				<p class="muted">A lending repayment is kept as imported.</p>
			{:else if !live}
				{#each everything as g (g.scope)}
					<div class="chips" role="group" aria-label={g.label}>
						<span class="chips-group">{g.label}</span>
						{#each g.list as c (c.id)}
							<label>
								<input
									type="radio"
									name="category"
									value={c.id}
									checked={String(c.id) === category}
									required
								/>
								<span>{c.name}</span>
							</label>
						{/each}
					</div>
				{/each}
			{:else if options.length}
				<div class="chips">
					{#each options as c (c.id)}
						<label>
							<input
								type="radio"
								name="category"
								value={c.id}
								checked={String(c.id) === picked}
								onchange={() => (category = String(c.id))}
								required
							/>
							<span>{c.name}</span>
						</label>
					{/each}
				</div>
			{:else}
				<p class="notice warn">
					<Icon name="triangle-alert" />
					<span>
						Nothing to file this under yet — <a href="/settings/categories">add a category</a>.
					</span>
				</p>
			{/if}
		</div>

		<div class="row2">
			<div class="field">
				<label for="{uid}-date">Date</label>
				<input
					id="{uid}-date"
					name="date"
					type="date"
					bind:value={date}
					required
					readonly={readOnly}
				/>
			</div>
			<div class="field">
				<label for="{uid}-note">Note</label>
				<input
					id="{uid}-note"
					name="note"
					bind:value={note}
					autocomplete="off"
					placeholder="Optional"
					readonly={readOnly}
				/>
			</div>
		</div>

		{#if linkedGoal}
			<p class="linked">
				Contributes to a goal — its progress follows this amount, and it stays an outflow.
			</p>
		{/if}
		{#if error}<p class="error" id="{uid}-err" role="alert">{error}</p>{/if}
	</div>

	{#if !pad || (txn && deleteAction)}
		<div class="sheet-f">
			{#if txn && deleteAction}
				<button
					class="btn {armed ? 'danger' : 'ghost'}"
					type="submit"
					form="{uid}-del"
					disabled={busy}
					onclick={confirmDelete}
				>
					<Icon name="trash" />{armed ? 'Confirm delete' : 'Delete'}
				</button>
			{/if}
			{#if !pad}
				<span class="spacer"></span>
				{#if onCancel}
					<button class="btn ghost" type="button" onclick={onCancel}>Cancel</button>
				{:else if cancelHref}
					<a class="btn ghost" href={cancelHref}>Cancel</a>
				{/if}
				{#if !readOnly}
					<button class="btn primary" type="submit" disabled={busy}>
						{txn ? 'Save' : 'Add'}<kbd>↵</kbd>
					</button>
				{/if}
			{/if}
		</div>
	{/if}

	{#if pad}
		<!--
		  The phone's keypad: digits, 00 and the point write into the amount
		  above; the tall key submits. Always in reach of the thumb, and never
		  covering the category it has to be filed under.
		-->
		<div class="keypad" role="group" aria-label="Amount keypad">
			{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '00'] as k (k)}
				<button
					class="key"
					type="button"
					onclick={() => press(k)}
					aria-label={k === '.' ? 'Decimal point' : k === '00' ? 'Double zero' : k}>{k}</button
				>
			{/each}
			<button
				class="key key-del"
				type="button"
				onclick={() => press('del')}
				aria-label="Delete last digit"
			>
				<Icon name="delete" size={22} />
			</button>
			<button class="key key-ok" type="submit" disabled={busy}>{txn ? 'Save' : 'Add'}</button>
		</div>
	{/if}
</form>

{#if txn && deleteAction}
	<form id="{uid}-del" method="POST" action={deleteAction} use:enhance={remove} hidden></form>
{/if}
