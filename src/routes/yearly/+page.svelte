<script lang="ts">
	import Delta from '$lib/components/Delta.svelte';
	import Money from '$lib/components/Money.svelte';
	import { MONTH_NAMES } from '$lib/dates';
	import { formatBP } from '$lib/money';

	let { data } = $props();

	// Each headline is the sum of a table further down the page, so the tile and
	// the rows beneath it can never quote different figures.
	const income = $derived(data.summary.job + data.summary.sideHustle);
	const spent = $derived(data.allocation.rows.reduce((total, row) => total + row.actual, 0));
	const net = $derived(income - spent);

	const uncovered = $derived(
		data.allocation.uncoveredMonths.map((m) => MONTH_NAMES[m - 1]).join(', ')
	);
</script>

<svelte:head>
	<title>Yearly {data.year} — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>{data.year}</h1>
	<span class="context">Yearly rollup</span>
	<form class="actions" method="GET">
		<label class="visually-hidden" for="f-year">Year</label>
		<select id="f-year" name="year" onchange={(e) => e.currentTarget.form?.submit()}>
			{#each data.years as y (y)}
				<option value={y} selected={data.year === y}>{y}</option>
			{/each}
		</select>
		<noscript><button type="submit">Show</button></noscript>
	</form>
</div>

<div class="kpis">
	<div class="kpi">
		<div class="label">Income</div>
		<!-- Green only ever arrives with a sign: the money-cell convention carries
		     the `+`, so the tile reads the same way as the rows beneath it. -->
		<div class="value"><Money value={income} direction="income" /></div>
		<Delta current={income} previous={data.prior.income} label="vs {data.prior.label}" />
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
	<div class="kpi">
		<div class="label">Net</div>
		<!-- A negative net already carries its minus sign from formatMoney, so the
		     colour is reinforcement rather than the only signal. -->
		<div class="value {net < 0 ? 'neg' : ''}"><Money value={net} /></div>
	</div>
</div>

<!--
  One notice at most, in order of how much it explains. "No period at all"
  already accounts for every dash in the table, so it supersedes the other two;
  with no income booked the allocation is zero whatever the coverage, so that
  supersedes the partial-coverage note.
-->
{#if data.allocation.coverage === 'none'}
	<!--
	  `none` means no month *with activity* is covered, which is not the same as
	  "no period exists": a period dated later than every transaction in the year
	  lands here too. The wording has to be true of both, and the remedy is an
	  earlier effective date either way.
	-->
	<p class="notice">
		No budget period covers any month with activity in {data.year}, so there is no plan to measure
		the spending below against. Add one dated 1 January {data.year} or earlier in
		<a href="/settings/budget">Budget settings</a>.
	</p>
{:else if data.awaitingIncome}
	<p class="notice">
		No income is booked in {data.year}, so there was nothing to allocate. The buckets below show
		what was spent; targets appear once income lands.
	</p>
{:else if data.allocation.coverage === 'partial'}
	<!--
	  Allocated counts covered months only; Actual counts every month. Remaining
	  is therefore a partial-year plan minus a whole-year spend, so it never
	  reads high — it is exact when the uncovered months spent nothing in a
	  bucket, and on a big uncovered month low enough to paint an overspend that
	  never happened. The arithmetic is not rescaled (that would invent a plan
	  for months that never had one), so the notice has to say plainly which
	  columns are affected and how.
	-->
	<p class="notice">
		No budget period covers {uncovered}. Spending in
		{data.allocation.uncoveredMonths.length === 1 ? 'that month' : 'those months'} still counts toward
		Actual, but Allocated covers only the rest of the year — so Remaining can be understated and show
		an overspend that never happened, and Allocated share divides a partial plan by the whole year's income.
		Backdate a period in <a href="/settings/budget">Budget settings</a> to cover the year.
	</p>
{/if}

<div class="panels">
	<section class="panel">
		<div class="panel-head"><h2>Allocation vs actual</h2></div>
		<!--
	  The caption sits above the columns it explains rather than below them, so the
	  reader meets the definition before the figures. `unallocated` is deliberately
	  described and not printed: it is income − spent, the identical number to the
	  Net tile, and the same figure under two labels reads as two facts.
	-->
		<div class="panel-body">
			<p class="prose">
				Allocated share is allocated ÷ income — the blended weight of every split in force this
				year, not the share spent. Income that reached no bucket is the Net above.
			</p>
		</div>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Bucket</th>
						<th scope="col" class="num">Allocated</th>
						<th scope="col" class="num">Actual</th>
						<th scope="col" class="num">Remaining</th>
						<th scope="col" class="num">Allocated share</th>
					</tr>
				</thead>
				<tbody>
					{#each data.allocation.rows as row (row.bucket)}
						<tr>
							<td data-label="Bucket">{row.label}</td>
							<td data-label="Allocated" class="num amount">
								<Money value={row.allocated ?? 0} />
							</td>
							<td data-label="Actual" class="num amount"><Money value={row.actual} /></td>
							<!--
					  Rendered exactly as the monthly view renders the same fact — same
					  figure, same sign, same component — so a ₹10,000 overspend cannot
					  read one way here and the other there. `formatCell` emits the minus,
					  so the colour reinforces a sign rather than carrying the meaning.
					  Before income lands, and with no period covering the year, there is
					  no allocation to have anything left of: that is nothing yet, not an
					  overspend.
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
							<td data-label="Allocated share" class="num muted">
								{row.effectiveBP == null ? '—' : formatBP(row.effectiveBP)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="panel">
		<div class="panel-head"><h2>Income split</h2></div>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Source</th>
						<th scope="col" class="num">Amount</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td data-label="Source">Job</td>
						<td data-label="Amount" class="num amount">
							<Money value={data.summary.job} direction="income" />
						</td>
					</tr>
					<tr>
						<td data-label="Source">Side hustle</td>
						<td data-label="Amount" class="num amount">
							<Money value={data.summary.sideHustle} direction="income" />
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!--
	  Twelve rows and five columns — the tallest table on the page, and last, so
	  it takes the full width rather than setting a row height that leaves the
	  panel beside it floating above a gap. No `.grow`: the columns share.
	-->
	<section class="panel wide">
		<div class="panel-head"><h2>By month</h2></div>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Month</th>
						<th scope="col" class="num">Income</th>
						<th scope="col" class="num">Needs</th>
						<th scope="col" class="num">Wants</th>
						<th scope="col" class="num">Investments</th>
					</tr>
				</thead>
				<tbody>
					{#each data.months as m (m.month)}
						<tr>
							<td data-label="Month">
								<a href="/monthly?year={data.year}&month={m.month}">{MONTH_NAMES[m.month - 1]}</a>
							</td>
							<td data-label="Income" class="num amount">
								<Money value={m.income} direction="income" />
							</td>
							<td data-label="Needs" class="num amount"><Money value={m.needs} /></td>
							<td data-label="Wants" class="num amount"><Money value={m.wants} /></td>
							<td data-label="Investments" class="num amount"><Money value={m.invest} /></td>
						</tr>
					{:else}
						<tr><td class="empty" colspan="5">No transactions in {data.year}.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
