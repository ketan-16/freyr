<script lang="ts">
	import { goto } from '$app/navigation';
	import Delta from '$lib/components/Delta.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Meter from '$lib/components/Meter.svelte';
	import Money from '$lib/components/Money.svelte';
	import { monthLabel, nextMonth, prevMonth } from '$lib/dates';
	import { formatBP, formatMoney } from '$lib/money';
	import { meter } from '$lib/progress';

	let { data } = $props();

	const s = $derived(data.summary);
	const prev = $derived(prevMonth(s.year, s.month));
	const next = $derived(nextMonth(s.year, s.month));
	const spent = $derived(s.rows.reduce((t, r) => t + r.actual, 0));
	const prevHref = $derived(`/monthly?year=${prev.year}&month=${prev.month}`);
	const nextHref = $derived(`/monthly?year=${next.year}&month=${next.month}`);

	// DESIGN.md asks for arrow-key stepping. Focus does not survive a
	// navigation, so a group-scoped handler would fire only once; this listens
	// at page level and stands down whenever a form control has focus.
	function onkeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
		const el = e.target as HTMLElement | null;
		if (el && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)))
			return;
		if (e.key === 'ArrowLeft') goto(prevHref);
		else if (e.key === 'ArrowRight') goto(nextHref);
	}
</script>

<svelte:window {onkeydown} />

<svelte:head>
	<title>Monthly — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>Monthly budget</h1>
</div>

<div class="toolbar">
	<div class="stepper">
		<a href={prevHref} aria-label="Previous month, {monthLabel(prev.year, prev.month)}">
			<Icon name="left" />
		</a>
		<span class="current">{monthLabel(s.year, s.month)}</span>
		<a href={nextHref} aria-label="Next month, {monthLabel(next.year, next.month)}">
			<Icon name="right" />
		</a>
	</div>
</div>

<div class="kpis">
	<div class="kpi">
		<div class="label">Income</div>
		<div class="value pos">{formatMoney(s.income)}</div>
		<Delta current={s.income} previous={data.prior.income} label="vs {data.prior.label}" />
	</div>
	<div class="kpi">
		<div class="label">Spent</div>
		<div class="value">{formatMoney(spent)}</div>
		<Delta
			current={spent}
			previous={data.prior.spent}
			lowerIsBetter
			label="vs {data.prior.label}"
		/>
	</div>
	<div class="kpi">
		<div class="label">Left</div>
		<div class="value {s.income - spent < 0 ? 'neg' : ''}">{formatMoney(s.income - spent)}</div>
	</div>
</div>

{#if !s.period}
	<p class="notice">
		No budget period covers this month yet — set one in
		<a href="/settings/budget">Budget settings</a>.
	</p>
{/if}

<h2>By bucket</h2>
<div class="table-wrap">
	<table>
		<thead>
			<tr>
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
