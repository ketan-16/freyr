<script lang="ts">
	import { goto } from '$app/navigation';
	import Delta from '$lib/components/Delta.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Meter from '$lib/components/Meter.svelte';
	import Money from '$lib/components/Money.svelte';
	import { monthLabel, nextMonth, prevMonth } from '$lib/dates';
	import { formatBP } from '$lib/money';
	import { meter } from '$lib/progress';

	let { data } = $props();

	const s = $derived(data.summary);
	const prev = $derived(prevMonth(s.year, s.month));
	const next = $derived(nextMonth(s.year, s.month));
	const spent = $derived(s.rows.reduce((t, r) => t + r.actual, 0));
	// One source for the tile and the table beneath it, exactly as home folds it:
	// income − spent is a second derivation, and the two disagree by a paisa the
	// moment `mulBP`'s rounding does not sum the shares back to income.
	const left = $derived(s.rows.reduce((t, r) => t + (r.remaining ?? 0), 0));
	const prevHref = $derived(`/monthly?year=${prev.year}&month=${prev.month}`);
	const nextHref = $derived(`/monthly?year=${next.year}&month=${next.month}`);
	/**
	 * Whether there is anything for the tile to be "left" of: a period to
	 * allocate by, and income for it to allocate. Missing either, every row's
	 * remaining is null or 0 − actual and the fold is a figure nobody planned —
	 * so the tile says nothing, the way the rows below it already do. Home gates
	 * its headline on the same two facts.
	 */
	const hasAllocationBasis = $derived(s.period != null && !data.awaitingIncome);

	/**
	 * Arrow-key stepping, scoped to the group (DESIGN.md § month-stepper). It
	 * catches keydown bubbling from whichever arrow has focus; `keepFocus` keeps
	 * that focus across the navigation, so repeated presses keep stepping. A
	 * window listener would instead hijack every arrow press on the page —
	 * horizontal scroll at 200% zoom, the table's own scroller, the rail.
	 */
	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		goto(e.key === 'ArrowLeft' ? prevHref : nextHref, { keepFocus: true });
	}
</script>

<svelte:head>
	<title>Monthly — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>Monthly budget</h1>
	<!--
	  The stepper is this screen's control, so it takes the head's action slot —
	  the corner every screen keeps its controls in.
	-->
	<div class="actions">
		<!-- The keys are pressed on the focused arrow link, which is interactive; the
		     group only listens as they bubble, so there is nothing here to focus. -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="stepper" role="group" aria-label="Month" {onkeydown}>
			<a href={prevHref} aria-label="Previous month, {monthLabel(prev.year, prev.month)}">
				<Icon name="left" />
			</a>
			<span class="current">{monthLabel(s.year, s.month)}</span>
			<a href={nextHref} aria-label="Next month, {monthLabel(next.year, next.month)}">
				<Icon name="right" />
			</a>
		</div>
	</div>
</div>

<div class="kpis">
	<div class="kpi">
		<div class="label">Income</div>
		<!-- Green only ever arrives with a sign: the money-cell convention carries
		     the `+`, so the tile reads the same way as the rows beneath it. -->
		<div class="value"><Money value={s.income} direction="income" /></div>
		<Delta current={s.income} previous={data.prior.income} label="vs {data.prior.label}" />
	</div>
	<div class="kpi">
		<div class="label">Spent</div>
		<div class="value"><Money value={spent} /></div>
		<Delta
			current={spent}
			previous={data.prior.spent}
			lowerIsBetter
			label="vs {data.prior.label}"
		/>
	</div>
	<!--
	  With no period covering the month, or no income booked, there is nothing to
	  be left of — every row's Allocated and Remaining is a dash, and so is this.
	  A figure here above a table of dashes was the contradiction being fixed.
	-->
	<div class="kpi">
		<div class="label">Left</div>
		<div class="value {hasAllocationBasis && left < 0 ? 'neg' : ''}">
			{#if hasAllocationBasis}<Money value={left} />{:else}<span class="faint">—</span>{/if}
		</div>
	</div>
</div>

{#if !s.period}
	<p class="notice">
		No budget period covers this month yet — set one in
		<a href="/settings/budget">Budget settings</a>.
	</p>
{:else if data.awaitingIncome}
	<p class="notice">
		No income is booked for {monthLabel(s.year, s.month)}, so there is nothing to allocate. Buckets
		show what was spent; targets appear once income lands.
	</p>
{/if}

<section class="panel">
	<div class="panel-head"><h2>By bucket</h2></div>
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<!-- No `.grow` in this table: six columns of figures, none of which
					     deserves the leftover width, so they share it. -->
					<th scope="col">Bucket</th>
					<th scope="col">Used</th>
					<th scope="col" class="num">Share</th>
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
						<td data-label="Share" class="num muted">{row.bp == null ? '—' : formatBP(row.bp)}</td>
						<td data-label="Allocated" class="num amount">
							<Money value={row.allocated ?? 0} />
						</td>
						<td data-label="Actual" class="num amount"><Money value={row.actual} /></td>
						<!--
					  Before income lands there is no allocation to have anything left
					  of, so remaining is not "0 − actual" overspend — it is nothing
					  yet, exactly as home renders it.
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
