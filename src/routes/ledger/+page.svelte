<script lang="ts">
	import { enhance } from '$app/forms';
	import EntryBar from '$lib/components/EntryBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { MONTH_NAMES, monthLabel } from '$lib/dates';
	import { formatMoney } from '$lib/money';

	let { data, form } = $props();

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

<EntryBar action="?/create" entry={data.entry} values={form?.values} />
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
