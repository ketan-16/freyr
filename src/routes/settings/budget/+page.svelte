<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import { formatBP } from '$lib/money';

	let { data, form } = $props();

	/**
	 * Four forms post to this page, so a failure names the one it belongs to and
	 * only that form re-renders the message and what was typed into it.
	 */
	const failed = $derived(form?.failed);
	const message = $derived(form?.error ?? '');
	const typed = $derived(form?.values ?? {});

	/**
	 * The editable inverse of `parsePercentBP`: 2720 → "27.20". `formatBP` owns
	 * the arithmetic — it is integer division and remainder, where `bp / 100`
	 * here was a float — and the only difference an input needs is the dropped
	 * `%`, which `parsePercentBP` would not accept back.
	 */
	const pct = (bp: number) => formatBP(bp).replace('%', '');
</script>

<svelte:head>
	<title>Budget settings — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>Budget</h1>
	<span class="muted">Periods are projected from the policy and the promotion log.</span>
</div>

<h2>Raise policy</h2>
<!--
  The destination is stated rather than implied: every raise pulls the weights a
  fraction of the way from the base split to the raise split, so a career of
  them settles on the raise split itself. Without the sentence the asymptote is
  invisible until enough promotions have been logged to see it happen.
-->
<p class="hero-sub">
	The base split applies to the starting salary; the raise split decides where each raise goes.
	Every raise moves the weights toward the raise split, so over a career they settle on it —
	{formatBP(data.policy.marginal.needsBP)} needs, {formatBP(data.policy.marginal.wantsBP)} wants,
	{formatBP(data.policy.marginal.investBP)} invest.
</p>

<details class="entry-wrap" open>
	<summary>Edit raise policy</summary>
	<form class="entry" method="POST" action="?/savePolicy" use:enhance>
		<div class="field">
			<label for="p-from">Base from</label>
			<!--
			  The message covers the whole submission — the domain validates each
			  triple as a triple, and the date against the promotion log — so it
			  describes the form's first control rather than pretending one field
			  owns it.
			-->
			<input
				id="p-from"
				name="base_effective_from"
				type="date"
				value={typed.base_effective_from ?? data.policy.baseEffectiveFrom}
				aria-describedby={failed === 'savePolicy' ? 'p-error' : undefined}
				required
			/>
		</div>
		<div class="field">
			<label for="p-base-needs">Base needs %</label>
			<input
				id="p-base-needs"
				class="money"
				name="base_needs"
				value={typed.base_needs ?? pct(data.policy.base.needsBP)}
				inputmode="decimal"
				required
			/>
		</div>
		<div class="field">
			<label for="p-base-wants">Base wants %</label>
			<input
				id="p-base-wants"
				class="money"
				name="base_wants"
				value={typed.base_wants ?? pct(data.policy.base.wantsBP)}
				inputmode="decimal"
				required
			/>
		</div>
		<div class="field">
			<label for="p-base-invest">Base invest %</label>
			<input
				id="p-base-invest"
				class="money"
				name="base_invest"
				value={typed.base_invest ?? pct(data.policy.base.investBP)}
				inputmode="decimal"
				required
			/>
		</div>
		<div class="field">
			<label for="p-marg-needs">Raise needs %</label>
			<input
				id="p-marg-needs"
				class="money"
				name="marg_needs"
				value={typed.marg_needs ?? pct(data.policy.marginal.needsBP)}
				inputmode="decimal"
				required
			/>
		</div>
		<div class="field">
			<label for="p-marg-wants">Raise wants %</label>
			<input
				id="p-marg-wants"
				class="money"
				name="marg_wants"
				value={typed.marg_wants ?? pct(data.policy.marginal.wantsBP)}
				inputmode="decimal"
				required
			/>
		</div>
		<div class="field">
			<label for="p-marg-invest">Raise invest %</label>
			<input
				id="p-marg-invest"
				class="money"
				name="marg_invest"
				value={typed.marg_invest ?? pct(data.policy.marginal.investBP)}
				inputmode="decimal"
				required
			/>
		</div>
		<button class="primary" type="submit">Save policy</button>
	</form>
	{#if failed === 'savePolicy'}<p class="error" id="p-error" role="alert">{message}</p>{/if}
</details>

<h2>Promotions</h2>

<details class="entry-wrap" open>
	<summary>Log a promotion</summary>
	<form class="entry" method="POST" action="?/addPromotion" use:enhance>
		<div class="field">
			<label for="r-date">Effective date</label>
			<input
				id="r-date"
				name="effective_date"
				type="date"
				value={typed.effective_date ?? data.today}
				aria-describedby={failed === 'addPromotion' ? 'r-error' : undefined}
				required
			/>
		</div>
		<div class="field">
			<label for="r-increment">Raise %</label>
			<input
				id="r-increment"
				class="money"
				name="increment"
				value={typed.increment ?? ''}
				inputmode="decimal"
				autocomplete="off"
				required
			/>
		</div>
		<div class="field grow">
			<label for="r-note">Note</label>
			<input id="r-note" name="note" value={typed.note ?? ''} autocomplete="off" />
		</div>
		<button class="primary" type="submit">Log promotion</button>
	</form>
	{#if failed === 'addPromotion'}<p class="error" id="r-error" role="alert">{message}</p>{/if}
</details>

<!-- Row deletes have no control of their own to hang a message on. -->
{#if failed === 'deletePromotion'}<p class="error" role="alert">{message}</p>{/if}

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Effective</th>
				<th scope="col" class="num">Raise</th>
				<th scope="col" class="num">Needs</th>
				<th scope="col" class="num">Wants</th>
				<th scope="col" class="num">Invest</th>
				<th scope="col">Note</th>
				<th scope="col"><span class="visually-hidden">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			<!--
			  Needs/Wants/Invest are the split this raise produced, every earlier
			  raise folded in — not the raise's own share of anything.
			-->
			{#each data.promotions as promotion (promotion.id)}
				<tr>
					<td data-label="Effective" class="num">{promotion.effectiveDate}</td>
					<td data-label="Raise" class="num">{formatBP(promotion.incrementBP)}</td>
					<td data-label="Needs" class="num">{formatBP(promotion.weights.needsBP)}</td>
					<td data-label="Wants" class="num">{formatBP(promotion.weights.wantsBP)}</td>
					<td data-label="Invest" class="num">{formatBP(promotion.weights.investBP)}</td>
					<td data-label={promotion.note ? 'Note' : null} class="muted">{promotion.note ?? ''}</td>
					<td data-label="">
						<form method="POST" action="?/deletePromotion" use:enhance>
							<input type="hidden" name="id" value={promotion.id} />
							<button
								class="icon"
								type="submit"
								aria-label="Delete the raise effective {promotion.effectiveDate}"
							>
								<Icon name="trash" />
							</button>
						</form>
					</td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="7">No promotions logged yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<h2>Periods</h2>
<p class="hero-sub">
	Base and promotion rows are rewritten from the policy above every time it changes. A manual row is
	never rewritten and outranks a generated one on the same date, so it is how you correct a single
	month.
</p>

<details class="entry-wrap" open>
	<summary>Add a period</summary>
	<form class="entry" method="POST" action="?/addPeriod" use:enhance>
		<div class="field">
			<label for="b-from">Effective from</label>
			<input
				id="b-from"
				name="effective_from"
				type="date"
				value={typed.effective_from ?? data.today}
				aria-describedby={failed === 'addPeriod' ? 'b-error' : undefined}
				required
			/>
		</div>
		<div class="field">
			<label for="b-needs">Needs %</label>
			<input
				id="b-needs"
				class="money"
				name="needs"
				value={typed.needs ?? ''}
				inputmode="decimal"
				autocomplete="off"
				required
			/>
		</div>
		<div class="field">
			<label for="b-wants">Wants %</label>
			<input
				id="b-wants"
				class="money"
				name="wants"
				value={typed.wants ?? ''}
				inputmode="decimal"
				autocomplete="off"
				required
			/>
		</div>
		<div class="field">
			<label for="b-invest">Invest %</label>
			<input
				id="b-invest"
				class="money"
				name="invest"
				value={typed.invest ?? ''}
				inputmode="decimal"
				autocomplete="off"
				required
			/>
		</div>
		<button class="primary" type="submit">Add period</button>
	</form>
	{#if failed === 'addPeriod'}<p class="error" id="b-error" role="alert">{message}</p>{/if}
</details>

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Effective from</th>
				<th scope="col" class="num">Needs</th>
				<th scope="col" class="num">Wants</th>
				<th scope="col" class="num">Invest</th>
				<th scope="col">Source</th>
				<th scope="col">Status</th>
			</tr>
		</thead>
		<tbody>
			{#each data.periods as period (period.id)}
				<tr>
					<td data-label="Effective from" class="num">{period.effectiveFrom}</td>
					<td data-label="Needs" class="num">{formatBP(period.needsBP)}</td>
					<td data-label="Wants" class="num">{formatBP(period.wantsBP)}</td>
					<td data-label="Invest" class="num">{formatBP(period.investBP)}</td>
					<!-- A source is a category, not a direction: monochrome, like a bucket tag. -->
					<td data-label="Source"><span class="tag">{period.source}</span></td>
					<td data-label={period.id === data.activeId ? 'Status' : null}>
						{#if period.id === data.activeId}<span class="tag">active</span>{/if}
					</td>
				</tr>
			{:else}
				<tr><td class="empty" colspan="6">No budget periods yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
