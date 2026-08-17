<script lang="ts">
	import Delta from '$lib/components/Delta.svelte';
	import EntryBar from '$lib/components/EntryBar.svelte';
	import Meter from '$lib/components/Meter.svelte';
	import Money from '$lib/components/Money.svelte';
	import { monthLabel, shortDate } from '$lib/dates';
	import { formatCell } from '$lib/format';
	import { formatMoney } from '$lib/money';
	import { meter } from '$lib/progress';

	let { data, form } = $props();

	const s = $derived(data.summary);
	const allocated = $derived(s.rows.reduce((total, row) => total + (row.allocated ?? 0), 0));
	// One source for the headline and the table beneath it: the hero is the sum
	// of the rows' remaining, never an independently computed income − spent.
	const left = $derived(s.rows.reduce((total, row) => total + (row.remaining ?? 0), 0));
	const daysLeft = $derived(data.daysInMonth - data.day);
	const daysWord = $derived(daysLeft === 1 ? 'day' : 'days');
	/**
	 * Whether there is anything for the headline to be "left" of: a period to
	 * allocate by, and income for it to allocate. Missing either, every row's
	 * allocated and remaining fold to 0 and the hero would read "₹0 left of ₹0
	 * allocated" — a figure nobody recorded. Fall through to spend-so-far, which
	 * is a fact either way.
	 */
	const hasAllocationBasis = $derived(s.period != null && !data.awaitingIncome);
	/**
	 * The headline is a sentence, not a table cell, so the zero convention needs
	 * a word where `money-cell` uses a dash — "— left" is not English. The figure
	 * still goes through `formatCell`, so `₹0` can never reach the page; zero
	 * just becomes the sentence that says so.
	 */
	const leftLine = $derived(left === 0 ? 'Nothing left' : `${formatCell(left)} left`);
	const spentLine = $derived(
		data.spent === 0 ? 'Nothing spent yet' : `${formatCell(data.spent)} spent`
	);
</script>

<svelte:head>
	<title>Home — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>{monthLabel(s.year, s.month)}</h1>
	<span class="context">This month</span>
</div>

{#if hasAllocationBasis}
	<p class="hero">
		<span class="figure">{leftLine}</span>
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
		of {formatMoney(allocated)} allocated · {daysLeft}
		{daysWord} remaining
	</p>
{:else}
	<!--
	  Nothing to be "left" of, so the headline states the one figure that was
	  actually recorded. The sub-line says which basis is missing; when it is the
	  budget period, the notice below carries the remedy, so it is not repeated
	  here.
	-->
	<p class="hero">
		<span class="figure">{spentLine}</span>
		<Delta
			current={data.spent}
			previous={data.prior.spent}
			lowerIsBetter
			label="vs {data.prior.label}"
		/>
	</p>
	<p class="hero-sub">
		{data.awaitingIncome ? "Awaiting this month's income" : 'Spent so far'} · {daysLeft}
		{daysWord} remaining
	</p>
	{#if data.awaitingIncome}
		<p class="notice">
			Allocations follow the income booked this month, and none is recorded yet. Buckets show what
			you have spent; targets appear once income lands.
		</p>
	{/if}
{/if}

{#if !s.period}
	<p class="notice">
		No budget period covers this month — set one in <a href="/settings/budget">Budget settings</a>.
	</p>
{/if}

<!--
  Three figures the headline does not already carry: it reports what is left,
  of what was allocated, with how many days to go. A tile repeating one of
  those would print a single fact under two labels. Lendings outstanding was a
  loose line at the foot of the page before — it is a standing figure, so it
  belongs with the standing figures.
-->
<div class="kpis">
	<div class="kpi">
		<div class="label">Income</div>
		<!-- Green only ever arrives with a sign: the money-cell convention carries
		     the `+`, so the tile reads the same way as the rows beneath it. -->
		<div class="value"><Money value={s.income} direction="income" /></div>
	</div>
	<div class="kpi">
		<div class="label">Spent</div>
		<div class="value"><Money value={data.spent} /></div>
	</div>
	<div class="kpi">
		<div class="label">Lendings out</div>
		<div class="value"><Money value={data.lendingsOutstanding} /></div>
	</div>
</div>

<div class="panels">
	<section class="panel">
		<div class="panel-head"><h2>Buckets</h2></div>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col" class="grow">Bucket</th>
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
							<td data-label="Bucket" class="grow">{row.label}</td>
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
							<!--
							  Before income lands there is no allocation to have anything left of,
							  so remaining is not "0 − actual" overspend — it is nothing yet. The
							  whole point of the awaiting-income state is to not read as three
							  blown budgets before payday.
							-->
							<td
								data-label="Remaining"
								class="num amount {data.awaitingIncome || row.remaining == null
									? ''
									: row.remaining < 0
										? 'neg'
										: ''}"
							>
								{#if data.awaitingIncome}
									<span class="faint">—</span>
								{:else}
									<Money value={row.remaining ?? 0} />
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="panel">
		<div class="panel-head"><h2>Goals</h2></div>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col" class="grow">Goal</th>
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
							<td data-label="Goal" class="grow">
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
	</section>

	<!--
	  The entry bar is a toolbar for the table below it, not a section of its
	  own — it spans the same width as the rows it writes, so a new row appears
	  where the eye already is (DESIGN.md § entry-bar). It used to sit under an
	  "Add" heading two tables away from the one it feeds.
	-->
	<div class="wide">
		<EntryBar action="?/create" entry={data.entry} values={form?.values} error={form?.error} />
	</div>

	<section class="panel wide">
		<div class="panel-head">
			<h2>Recent</h2>
			<span class="meta"><a href="/ledger">All transactions</a></span>
		</div>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col" class="date">Date</th>
						<th scope="col" class="num">Amount</th>
						<th scope="col">Type</th>
						<th scope="col">Category</th>
						<th scope="col" class="grow">Note</th>
					</tr>
				</thead>
				<tbody>
					{#each data.recent as t (t.id)}
						<tr>
							<!--
							  Recent crosses month ends, so the year is passed as the context the
							  screen is scoped to and printed only on a row that falls outside it.
							-->
							<td data-label="Date" class="date">{shortDate(t.date, s.year)}</td>
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
							<td data-label={t.note ? 'Note' : null} class="muted grow">{t.note ?? ''}</td>
						</tr>
					{:else}
						<tr><td class="empty" colspan="5">Nothing recorded yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
