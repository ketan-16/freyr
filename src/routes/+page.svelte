<script lang="ts">
	import Delta from '$lib/components/Delta.svelte';
	import EntryBar from '$lib/components/EntryBar.svelte';
	import Meter from '$lib/components/Meter.svelte';
	import Money from '$lib/components/Money.svelte';
	import { monthLabel } from '$lib/dates';
	import { formatMoney } from '$lib/money';
	import { meter } from '$lib/progress';

	let { data, form } = $props();

	const s = $derived(data.summary);
	const allocated = $derived(s.rows.reduce((total, row) => total + (row.allocated ?? 0), 0));
	// One source for the headline and the table beneath it: the hero is the sum
	// of the rows' remaining, never an independently computed income − spent.
	const left = $derived(s.rows.reduce((total, row) => total + (row.remaining ?? 0), 0));
	const daysLeft = $derived(data.daysInMonth - data.day);
</script>

<svelte:head>
	<title>Home — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>{monthLabel(s.year, s.month)}</h1>
	<span class="muted">This month</span>
</div>

{#if data.awaitingIncome}
	<p class="hero">
		<span class="figure">{formatMoney(data.spent)} spent</span>
		<Delta
			current={data.spent}
			previous={data.prior.spent}
			lowerIsBetter
			label="vs {data.prior.label}"
		/>
	</p>
	<p class="hero-sub">Awaiting this month's income · {daysLeft} days remaining</p>
	<p class="notice">
		Allocations follow the income booked this month, and none is recorded yet. Buckets show what you
		have spent; targets appear once income lands.
	</p>
{:else}
	<p class="hero">
		<span class="figure">{formatMoney(left)} left</span>
		<!--
		  The headline is what remains; the delta reports spending pace against
		  the same span of days last month. Comparing "left" across two months
		  would compare two different allocations and mean nothing.
		-->
		<Delta
			current={data.spent}
			previous={data.prior.spent}
			lowerIsBetter
			label="spent vs {data.prior.label}"
		/>
	</p>
	<p class="hero-sub">
		of {formatMoney(allocated)} allocated · {daysLeft} days remaining
	</p>
{/if}

{#if !s.period}
	<p class="notice">
		No budget period covers this month — set one in <a href="/settings/budget">Budget settings</a>.
	</p>
{/if}

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Bucket</th>
				<th scope="col">Used</th>
				<th scope="col" class="num">Allocated</th>
				<th scope="col" class="num">Actual</th>
				<th scope="col" class="num">Remaining</th>
			</tr>
		</thead>
		<tbody>
			{#each s.rows as row (row.bucket)}
				{@const m = meter(row.actual, row.allocated)}
				<tr>
					<td data-label="Bucket">{row.label}</td>
					<td data-label="Used">
						<span class="meter-cell">
							<Meter value={m} />
							<span class="pct">{m ? `${m.pct}%` : ''}</span>
						</span>
					</td>
					<td data-label="Allocated" class="num amount">
						<Money value={row.allocated ?? 0} />
					</td>
					<td data-label="Actual" class="num amount"><Money value={row.actual} /></td>
					<td
						data-label="Remaining"
						class="num amount {row.remaining == null ? '' : row.remaining < 0 ? 'neg' : ''}"
					>
						<Money value={row.remaining ?? 0} />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<h2>Add</h2>
<EntryBar action="?/create" entry={data.entry} values={form?.values} />
{#if form?.error}<p class="error">{form.error}</p>{/if}

<h2>Recent</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Date</th>
				<th scope="col" class="num">Amount</th>
				<th scope="col">Type</th>
				<th scope="col">Category</th>
				<th scope="col">Note</th>
			</tr>
		</thead>
		<tbody>
			{#each data.recent as t (t.id)}
				<tr>
					<td data-label="Date" class="num">{t.date}</td>
					<td data-label="Amount" class="num amount">
						<Money value={t.amountPaise} direction={t.direction} />
					</td>
					<td data-label="Type">
						{#if t.direction === 'income'}
							<span class="tag">income</span>
						{:else}
							<span class="tag">{t.bucket}</span>
						{/if}
					</td>
					<td data-label={t.categoryName ? 'Category' : null}>{t.categoryName ?? ''}</td>
					<td data-label={t.note ? 'Note' : null} class="muted">{t.note ?? ''}</td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="5">Nothing recorded yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<h2>Goals</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Goal</th>
				<th scope="col">Progress</th>
				<th scope="col" class="num">Saved</th>
				<th scope="col" class="num">Target</th>
				<th scope="col" class="num">%</th>
			</tr>
		</thead>
		<tbody>
			{#each data.goals as g (g.goal.id)}
				{@const m = meter(g.contributed, g.goal.targetPaise)}
				<tr>
					<td data-label="Goal">
						{g.goal.name}
						{#if g.goal.kind === 'pot'}<span class="tag">pot</span>{/if}
					</td>
					<td data-label="Progress"><Meter value={m} /></td>
					<td data-label="Saved" class="num amount"><Money value={g.contributed} /></td>
					<td data-label="Target" class="num amount">
						<Money value={g.goal.targetPaise ?? 0} />
					</td>
					<td data-label="%" class="num">{m ? `${m.pct}%` : '—'}</td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="5">No goals yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<p class="hero-sub">Lendings outstanding {formatMoney(data.lendingsOutstanding)}</p>
