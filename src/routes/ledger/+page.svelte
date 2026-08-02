<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import { MONTH_NAMES, monthLabel } from '$lib/dates';
	import { formatMoney } from '$lib/money';

	let { data, form } = $props();

	let amountInput: HTMLInputElement | undefined = $state();
	let direction = $state('outflow');

	const years = $derived.by(() => {
		const current = Number(data.today.slice(0, 4));
		const ys: number[] = [];
		for (let y = Math.min(2021, data.filters.year); y <= current; y++) ys.push(y);
		if (!ys.includes(data.filters.year)) ys.push(data.filters.year);
		return ys.sort((a, b) => a - b);
	});

	const total = $derived(
		data.transactions.reduce((t, x) => t + (x.direction === 'income' ? 0 : x.amountPaise), 0)
	);
</script>

<svelte:head>
	<title>Ledger — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>Ledger</h1>
	<span class="muted">{monthLabel(data.filters.year, data.filters.month)}</span>
	<span class="muted">·</span>
	<span class="muted num">{data.transactions.length} entries, {formatMoney(total)} out</span>
</div>

<form class="toolbar" method="GET">
	<label class="visually-hidden" for="f-month">Month</label>
	<select id="f-month" name="month" onchange={(e) => e.currentTarget.form?.submit()}>
		{#each MONTH_NAMES as name, i (name)}
			<option value={i + 1} selected={data.filters.month === i + 1}>{name}</option>
		{/each}
	</select>
	<select name="year" onchange={(e) => e.currentTarget.form?.submit()} aria-label="Year">
		{#each years as y (y)}
			<option value={y} selected={data.filters.year === y}>{y}</option>
		{/each}
	</select>
	<select name="bucket" onchange={(e) => e.currentTarget.form?.submit()} aria-label="Bucket">
		<option value="">All buckets</option>
		{#each ['needs', 'wants', 'investments'] as b (b)}
			<option value={b} selected={data.filters.bucket === b}>{b}</option>
		{/each}
	</select>
	<noscript><button type="submit">Filter</button></noscript>
</form>

<details class="entry-wrap" open>
	<summary>Add transaction</summary>
	<form
		class="entry"
		method="POST"
		action="?/create"
		use:enhance={() =>
			async ({ update }) => {
				await update();
				amountInput?.focus();
			}}
	>
		<div class="field">
			<label for="e-date">Date</label>
			<input
				id="e-date"
				name="date"
				type="date"
				value={form?.values?.date ?? data.today}
				required
			/>
		</div>
		<div class="field">
			<label for="e-amount">Amount ₹</label>
			<input
				id="e-amount"
				class="money"
				name="amount"
				bind:this={amountInput}
				value={form?.values?.amount ?? ''}
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
				<input
					id="e-category"
					name="category"
					list="categories"
					value={form?.values?.category ?? ''}
				/>
				<datalist id="categories">
					{#each data.categories as c (c.id)}<option value={c.name}></option>{/each}
				</datalist>
			</div>
			<div class="field">
				<label for="e-goal">Goal</label>
				<select id="e-goal" name="goal">
					<option value="">—</option>
					{#each data.goals as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="e-location">Location</label>
				<select id="e-location" name="location">
					<option value="">—</option>
					{#each data.locations as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
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
			<input id="e-note" name="note" value={form?.values?.note ?? ''} autocomplete="off" />
		</div>
		<button class="primary" type="submit">Add</button>
	</form>
</details>
{#if form?.error}<p class="error">{form.error}</p>{/if}

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Date</th>
				<th scope="col" class="num">Amount</th>
				<th scope="col">Type</th>
				<th scope="col">Category</th>
				<th scope="col">Goal</th>
				<th scope="col">Note</th>
				<th scope="col"><span class="visually-hidden">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.transactions as t (t.id)}
				<tr>
					<td data-label="Date" class="num">{t.date}</td>
					<td data-label="Amount" class="num amount {t.direction === 'income' ? 'pos' : ''}">
						{t.direction === 'income' ? '+' : ''}{formatMoney(t.amountPaise)}
					</td>
					<td data-label="Type">
						{#if t.direction === 'income'}
							<span class="tag">income</span>
							<span class="muted">{t.incomeSource}</span>
						{:else}
							<span class="tag">{t.bucket}</span>
						{/if}
					</td>
					<td data-label={t.categoryName ? 'Category' : null}>{t.categoryName ?? ''}</td>
					<td data-label={t.goalName || t.lendingPerson ? 'Goal' : null}>
						{#if t.goalName}{t.goalName}
							<span class="faint">@ {t.locationName}</span>{/if}
						{#if t.lendingPerson}<span class="faint">{t.lendingPerson}</span>{/if}
					</td>
					<td data-label={t.note ? 'Note' : null} class="muted">{t.note ?? ''}</td>
					<td data-label="">
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={t.id} />
							<button class="icon" type="submit" aria-label="Delete transaction">
								<Icon name="trash" />
							</button>
						</form>
					</td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="7">No transactions this month.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
