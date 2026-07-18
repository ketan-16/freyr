<script lang="ts">
	import { enhance } from '$app/forms';
	import { MONTH_NAMES, monthLabel } from '$lib/dates';
	import { formatMoney } from '$lib/money';

	let { data, form } = $props();

	let amountInput: HTMLInputElement | undefined = $state();
	let direction = $state('outflow');

	const years = $derived.by(() => {
		const ys = new Set([data.filters.year, Number(data.today.slice(0, 4))]);
		for (let y = 2021; y <= Number(data.today.slice(0, 4)); y++) ys.add(y);
		return [...ys].sort();
	});
</script>

<svelte:head>
	<title>Ledger — Freyr</title>
</svelte:head>

<h1>Ledger</h1>

<form class="toolbar" method="GET">
	<label for="f-month" class="visually-hidden">Month</label>
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
	<span class="muted">{monthLabel(data.filters.year, data.filters.month)}</span>
</form>

<form
	class="row entry"
	method="POST"
	action="?/create"
	use:enhance={() =>
		async ({ update }) => {
			await update();
			amountInput?.focus();
		}}
>
	<div>
		<label for="e-date">Date</label>
		<input id="e-date" name="date" type="date" value={form?.values?.date ?? data.today} required />
	</div>
	<div>
		<label for="e-amount">Amount ₹</label>
		<input
			id="e-amount"
			name="amount"
			bind:this={amountInput}
			value={form?.values?.amount ?? ''}
			inputmode="decimal"
			autocomplete="off"
			required
		/>
	</div>
	<div>
		<label for="e-direction">Direction</label>
		<select id="e-direction" name="direction" bind:value={direction}>
			<option value="outflow">Outflow</option>
			<option value="income">Income</option>
		</select>
	</div>
	{#if direction === 'outflow'}
		<div>
			<label for="e-bucket">Bucket</label>
			<select id="e-bucket" name="bucket">
				<option value="needs">Needs</option>
				<option value="wants">Wants</option>
				<option value="investments">Investments</option>
			</select>
		</div>
		<div>
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
		<div>
			<label for="e-goal">Goal</label>
			<select id="e-goal" name="goal">
				<option value="">—</option>
				{#each data.goals as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
			</select>
		</div>
		<div>
			<label for="e-location">Location</label>
			<select id="e-location" name="location">
				<option value="">—</option>
				{#each data.locations as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
			</select>
		</div>
	{:else}
		<div>
			<label for="e-source">Source</label>
			<select id="e-source" name="source">
				<option value="job">Job</option>
				<option value="side_hustle">Side hustle</option>
				<option value="other">Other</option>
			</select>
		</div>
	{/if}
	<div class="grow">
		<label for="e-note">Note</label>
		<input id="e-note" name="note" value={form?.values?.note ?? ''} autocomplete="off" />
	</div>
	<button class="primary" type="submit">Add</button>
</form>
{#if form?.error}<p class="error">{form.error}</p>{/if}

<table>
	<thead>
		<tr>
			<th>Date</th>
			<th class="num">Amount</th>
			<th>Type</th>
			<th>Category</th>
			<th>Goal</th>
			<th>Note</th>
			<th></th>
		</tr>
	</thead>
	<tbody>
		{#each data.transactions as t (t.id)}
			<tr>
				<td>{t.date}</td>
				<td class="num {t.direction === 'income' ? 'pos' : ''}">
					{t.direction === 'income' ? '+' : ''}{formatMoney(t.amountPaise)}
				</td>
				<td>{t.direction === 'income' ? `income · ${t.incomeSource}` : t.bucket}</td>
				<td>{t.categoryName ?? ''}</td>
				<td>
					{#if t.goalName}{t.goalName}<span class="faint"> @ {t.locationName}</span>{/if}
					{#if t.lendingPerson}<span class="faint">{t.lendingPerson}</span>{/if}
				</td>
				<td class="muted">{t.note ?? ''}{t.imported ? '' : ''}</td>
				<td>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={t.id} />
						<button class="link" type="submit" aria-label="Delete transaction">×</button>
					</form>
				</td>
			</tr>
		{:else}
			<tr><td colspan="7" class="muted">No transactions this month.</td></tr>
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
	.entry .grow {
		flex: 1;
		min-width: 8rem;
	}
	.entry .grow input {
		width: 100%;
	}
	.entry input[name='amount'] {
		width: 7rem;
	}
	.entry input[name='date'] {
		width: 8.5rem;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
