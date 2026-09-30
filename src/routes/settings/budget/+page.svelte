<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ShareBar from '$lib/components/ShareBar.svelte';
	import SplitChart from '$lib/components/SplitChart.svelte';
	import { shortDate } from '$lib/dates';
	import { formatBP, parsePercentBP } from '$lib/money';

	let { data, form } = $props();

	/**
	 * Four forms post to this page, so a failure names the one it belongs to and
	 * only that form re-renders the message and what was typed into it.
	 */
	const failed = $derived(form?.failed);
	const message = $derived(form?.error ?? '');
	const typed = $derived<Record<string, string>>(form?.values ?? {});

	/** The editable inverse of parsePercentBP: 2720 → "27.20". */
	const pct = (bp: number) => formatBP(bp).replace('%', '');

	const BUCKETS = [
		['needs', 'Needs'],
		['wants', 'Wants'],
		['invest', 'Investments']
	] as const;

	/**
	 * The policy's six shares as the form shows them, so each split can show its
	 * sum and proportion while it is typed: what was typed wins over what was
	 * saved (or posted, after a failure). Field names are the form's own.
	 */
	const saved = $derived({
		base_needs: typed.base_needs ?? pct(data.policy.base.needsBP),
		base_wants: typed.base_wants ?? pct(data.policy.base.wantsBP),
		base_invest: typed.base_invest ?? pct(data.policy.base.investBP),
		marg_needs: typed.marg_needs ?? pct(data.policy.marginal.needsBP),
		marg_wants: typed.marg_wants ?? pct(data.policy.marginal.wantsBP),
		marg_invest: typed.marg_invest ?? pct(data.policy.marginal.investBP)
	} as Record<string, string>);
	let edits = $state<Record<string, string>>({});
	const shareOf = (key: string) => edits[key] ?? saved[key] ?? '';

	/** A typed share in basis points, or null while it does not parse. */
	function bp(key: string): number | null {
		try {
			return parsePercentBP(shareOf(key));
		} catch {
			return null;
		}
	}

	function sum(prefix: string): number | null {
		const parts = BUCKETS.map(([b]) => bp(`${prefix}_${b}`));
		return parts.some((p) => p == null) ? null : parts.reduce((t, p) => t! + p!, 0);
	}

	const splits = [
		{ key: 'base', label: 'Base split', hint: 'The starting salary' },
		{ key: 'marg', label: 'Raise split', hint: 'Where each raise goes' }
	];

	const current = $derived(data.periods.find((p) => p.id === data.activeId) ?? null);
</script>

<svelte:head>
	<title>Splits — Freyr</title>
</svelte:head>

<PageHeader
	title="Splits"
	sub="How income divides across the buckets"
	back={{ href: '/settings', label: 'Settings' }}
/>

<div class="page">
	<section class="panel" aria-labelledby="traj-h">
		<div class="panel-h">
			<h2 id="traj-h">Split over time</h2>
			<div class="legend" style:margin-left="auto">
				<span><i style:--c="var(--needs)"></i>Needs</span>
				<span><i style:--c="var(--wants)"></i>Wants</span>
				<span><i style:--c="var(--invest)"></i>Investments</span>
			</div>
		</div>
		<div class="panel-b">
			{#if current}
				<p class="split-now">
					In force now: <b>{formatBP(current.needsBP)}</b> needs ·
					<b>{formatBP(current.wantsBP)}</b> wants · <b>{formatBP(current.investBP)}</b>
					investments, since {shortDate(current.effectiveFrom)}. Every raise moves the weights
					toward the raise split — {formatBP(data.policy.marginal.needsBP)} · {formatBP(
						data.policy.marginal.wantsBP
					)} ·
					{formatBP(data.policy.marginal.investBP)} — so over a career they settle on it.
				</p>
			{/if}
			<SplitChart periods={data.periods} promotions={data.promotions} today={data.today} />
		</div>
	</section>

	<div class="grid">
		<section class="panel c6" aria-labelledby="policy-h">
			<div class="panel-h">
				<h2 id="policy-h">Raise policy</h2>
			</div>
			<form class="panel-b policy" method="POST" action="?/savePolicy" use:enhance>
				<div class="field" style:max-width="11rem">
					<label for="p-from">Base split from</label>
					<!-- The message covers the whole submission, so it describes the first control. -->
					<input
						id="p-from"
						name="base_effective_from"
						type="date"
						value={typed.base_effective_from ?? data.policy.baseEffectiveFrom}
						aria-describedby={failed === 'savePolicy' ? 'p-error' : undefined}
						required
					/>
				</div>

				<div class="split-grid">
					<span class="corner"></span>
					{#each BUCKETS as [b, name] (b)}
						<span class="col-h" aria-hidden="true"><i class="sw {b}"></i>{name}</span>
					{/each}
					<span class="corner"></span>
					{#each splits as split (split.key)}
						{@const total = sum(split.key)}
						<span class="row-h">{split.label}<small>{split.hint}</small></span>
						{#each BUCKETS as [b, name] (b)}
							{@const field = `${split.key}_${b}`}
							<span class="affix">
								<label class="visually-hidden" for="p-{field}">{split.label}, {name} %</label>
								<input
									id="p-{field}"
									class="pct"
									name={field}
									value={shareOf(field)}
									oninput={(e) => (edits[field] = e.currentTarget.value)}
									inputmode="decimal"
									autocomplete="off"
									required
								/>
								<span class="post" aria-hidden="true">%</span>
							</span>
						{/each}
						<span class="sum" class:bad={total != null && total !== 10000}>
							{#if total != null}
								<ShareBar
									parts={BUCKETS.map(([b]) => ({ key: b, value: bp(`${split.key}_${b}`) ?? 0 }))}
								/>
								{total === 10000 ? '100%' : `${formatBP(total)} — must be 100%`}
							{/if}
						</span>
					{/each}
				</div>

				<div class="form-actions">
					<button class="btn primary" type="submit">Save policy</button>
					<span class="muted">Rewrites every base and promotion period below.</span>
				</div>
				{#if failed === 'savePolicy'}<p class="error" id="p-error" role="alert">{message}</p>{/if}
			</form>
		</section>

		<section class="panel c6" aria-labelledby="promo-h">
			<div class="panel-h">
				<h2 id="promo-h">Promotions</h2>
				<span class="meta">{data.promotions.length}</span>
			</div>
			<form class="panel-b form-row" method="POST" action="?/addPromotion" use:enhance>
				<div class="field" style:width="9.5rem">
					<label for="r-date">Effective</label>
					<input
						id="r-date"
						name="effective_date"
						type="date"
						value={typed.effective_date ?? data.today}
						aria-describedby={failed === 'addPromotion' ? 'r-error' : undefined}
						required
					/>
				</div>
				<div class="field" style:width="6rem">
					<label for="r-increment">Raise<span class="visually-hidden"> %</span></label>
					<span class="affix">
						<input
							id="r-increment"
							class="pct"
							name="increment"
							value={typed.increment ?? ''}
							inputmode="decimal"
							autocomplete="off"
							required
						/>
						<span class="post" aria-hidden="true">%</span>
					</span>
				</div>
				<div class="field grow">
					<label for="r-note">Note</label>
					<input id="r-note" name="note" value={typed.note ?? ''} autocomplete="off" />
				</div>
				<button class="btn primary" type="submit"><Icon name="plus" />Log</button>
			</form>
			{#if failed === 'addPromotion'}
				<p class="error panel-note" id="r-error" role="alert">{message}</p>
			{/if}
			<!-- Row deletes have no control of their own to hang a message on. -->
			{#if failed === 'deletePromotion'}<p class="error panel-note" role="alert">{message}</p>{/if}

			<div class="tbl-scroll">
				<table class="tbl">
					<thead>
						<tr>
							<th scope="col" class="first">Effective</th>
							<th scope="col" class="num">Raise</th>
							<th scope="col">Split after it</th>
							<th scope="col" class="grow">Note</th>
							<th scope="col" class="last"><span class="visually-hidden">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						<!-- The split each raise produced, every earlier raise folded in. -->
						{#each data.promotions as p (p.id)}
							<tr>
								<td class="first tnum">{shortDate(p.effectiveDate)}</td>
								<td class="num">+{formatBP(p.incrementBP)}</td>
								<td class="tnum">
									{formatBP(p.weights.needsBP)} · {formatBP(p.weights.wantsBP)} · {formatBP(
										p.weights.investBP
									)}
								</td>
								<td class="grow note-cell muted" title={p.note ?? undefined}>{p.note ?? ''}</td>
								<td class="last">
									<form method="POST" action="?/deletePromotion" use:enhance>
										<input type="hidden" name="id" value={p.id} />
										<button
											class="icon-btn danger"
											type="submit"
											aria-label="Delete the raise effective {p.effectiveDate}"
											title="Delete"
										>
											<Icon name="trash" size={15} />
										</button>
									</form>
								</td>
							</tr>
						{:else}
							<tr><td class="empty" colspan="5">No promotions logged yet.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>

	<section class="panel" aria-labelledby="periods-h">
		<div class="panel-h">
			<h2 id="periods-h">Periods</h2>
			<span class="meta">{data.periods.length}</span>
		</div>
		<p class="panel-note">
			Base and promotion rows are rewritten from the policy whenever it changes. A manual row is
			never rewritten and outranks a generated one on the same date — it is how you correct a single
			month.
		</p>
		<form class="panel-b form-row" method="POST" action="?/addPeriod" use:enhance>
			<div class="field" style:width="9.5rem">
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
			{#each [['b-needs', 'needs', 'Needs'], ['b-wants', 'wants', 'Wants'], ['b-invest', 'invest', 'Investments']] as [id, name, label] (id)}
				<div class="field" style:width="6.5rem">
					<label for={id}>{label}<span class="visually-hidden"> %</span></label>
					<span class="affix">
						<input
							{id}
							class="pct"
							{name}
							value={typed[name] ?? ''}
							inputmode="decimal"
							autocomplete="off"
							required
						/>
						<span class="post" aria-hidden="true">%</span>
					</span>
				</div>
			{/each}
			<button class="btn" type="submit"><Icon name="plus" />Add manual period</button>
		</form>
		{#if failed === 'addPeriod'}<p class="error panel-note" id="b-error" role="alert">
				{message}
			</p>{/if}

		<div class="tbl-scroll">
			<table class="tbl">
				<thead>
					<tr>
						<th scope="col" class="first">Effective from</th>
						<th scope="col">Split</th>
						<th scope="col" class="num">Needs</th>
						<th scope="col" class="num">Wants</th>
						<th scope="col" class="num">Invest</th>
						<th scope="col" class="grow last">Source</th>
					</tr>
				</thead>
				<tbody>
					{#each data.periods as period (period.id)}
						<tr class:current={period.id === data.activeId}>
							<td class="first tnum">{shortDate(period.effectiveFrom)}</td>
							<td>
								<ShareBar
									parts={[
										{ key: 'needs', value: period.needsBP },
										{ key: 'wants', value: period.wantsBP },
										{ key: 'invest', value: period.investBP }
									]}
								/>
							</td>
							<td class="num">{formatBP(period.needsBP)}</td>
							<td class="num">{formatBP(period.wantsBP)}</td>
							<td class="num">{formatBP(period.investBP)}</td>
							<td class="grow last">
								<span class="tag">{period.source}</span>
								{#if period.id === data.activeId}<span class="tag strong">in force</span>{/if}
							</td>
						</tr>
					{:else}
						<tr><td class="empty" colspan="6">No budget periods yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
