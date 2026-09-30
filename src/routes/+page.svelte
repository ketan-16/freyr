<script lang="ts">
	import Bullet from '$lib/components/Bullet.svelte';
	import Delta from '$lib/components/Delta.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Kpi from '$lib/components/Kpi.svelte';
	import Money from '$lib/components/Money.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PaceChart from '$lib/components/PaceChart.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Ranks from '$lib/components/Ranks.svelte';
	import { addMonths, MONTH_NAMES, monthLabel, shortDate } from '$lib/dates';
	import { share } from '$lib/format';
	import { formatBP, formatMoney } from '$lib/money';
	import { meter } from '$lib/progress';
	import { useUi, wantsNewTab } from '$lib/ui.svelte';

	let { data } = $props();

	const ui = useUi();
	const s = $derived(data.summary);
	const allocated = $derived(s.rows.reduce((t, r) => t + (r.allocated ?? 0), 0));
	// One source for the headline and the rows beneath it: what is left is the
	// sum of the rows' remaining, never an independent income − spent.
	const left = $derived(s.rows.reduce((t, r) => t + (r.remaining ?? 0), 0));
	/**
	 * Whether there is anything for the headline to be "left" of: a period to
	 * allocate by, and income for it to allocate. Missing either, every row
	 * folds to zero, so the headline falls back to spend-so-far — a fact
	 * either way.
	 */
	const hasBasis = $derived(s.period != null && !data.awaitingIncome);
	/** Today counts: on the last day there is one day left, not none. */
	const daysLeft = $derived(data.daysInMonth - data.day + 1);
	/**
	 * What can go out each remaining day without overspending. Rounded down —
	 * the rounding rule is that an allowance may understate, never overstate.
	 */
	const perDay = $derived(hasBasis && left > 0 ? Math.floor(left / daysLeft / 100) * 100 : null);
	const used = $derived(hasBasis ? meter(data.spent, allocated) : null);
	const spentToday = $derived.by(() => {
		const d = data.daily.find((t) => t.day === data.day);
		return d ? d.needs + d.wants + d.invest : 0;
	});
	const net = $derived(s.income - data.spent);
	const monthName = $derived(MONTH_NAMES[s.month - 1]);

	/** Six months ending this one, zero-filled, for the headline sparklines. */
	const trend = $derived.by(() => {
		const by = new Map(data.trend.map((t) => [`${t.year}-${t.month}`, t]));
		return Array.from({ length: 6 }, (_, i) => {
			const at = addMonths(s.year, s.month, i - 5);
			const t = by.get(`${at.year}-${at.month}`);
			return { income: t?.income ?? 0, spent: t ? t.needs + t.wants + t.invest : 0 };
		});
	});

	const BUCKET_LABEL = { needs: 'Needs', wants: 'Wants', investments: 'Invest' } as const;

	function edit(e: MouseEvent, txn: (typeof data.recent)[number]): void {
		if (wantsNewTab(e)) return;
		e.preventDefault();
		ui.edit(txn);
	}
</script>

<svelte:head>
	<title>Home — Freyr</title>
</svelte:head>

<PageHeader title="Home" sub={monthLabel(s.year, s.month)} />

<div class="page">
	{#if data.awaitingIncome}
		<Notice>
			Allocations follow the income booked this month, and none is recorded yet. Buckets show what
			you have spent; targets appear once income lands.
		</Notice>
	{/if}
	{#if !s.period}
		<Notice tone="warn">
			No budget period covers this month — set one in <a href="/settings/budget">Splits</a>.
		</Notice>
	{/if}

	<div class="grid">
		<!--
		  The headline is the one question this screen answers first: how much
		  can still go out this month. Everything around it is the evidence.
		-->
		<section class="panel c5 hero" aria-labelledby="hero-label">
			<p class="hero-label" id="hero-label">
				{hasBasis ? (left < 0 ? 'Over the allocation' : 'Left to spend') : 'Spent so far'} · {monthName}
			</p>
			{#if hasBasis}
				<p class="hero-fig" class:neg={left < 0}>
					{left === 0 ? 'Nothing left' : formatMoney(left)}<span class="of"
						>of {formatMoney(allocated)}</span
					>
				</p>
				{#if used}
					<div>
						<Bullet
							actual={data.spent}
							{allocated}
							mark={data.day / data.daysInMonth}
							tone="severity"
							size="tall"
							label="{used.pct}% of the allocation used, {Math.round(
								(data.day / data.daysInMonth) * 100
							)}% of the month gone"
						/>
						<p class="pace-legend">
							<span>{used.pct}% used</span>
							<span>Day {data.day} of {data.daysInMonth}</span>
						</p>
					</div>
				{/if}
			{:else}
				<p class="hero-fig">{data.spent === 0 ? 'Nothing spent yet' : formatMoney(data.spent)}</p>
				<p class="hero-sub">
					{data.awaitingIncome ? "Awaiting this month's income" : 'No split covers this month'}
				</p>
			{/if}
			<p class="hero-sub">
				<Delta
					current={data.spent}
					previous={data.prior.spent}
					lowerIsBetter
					label="spent vs {data.prior.label}, same days"
				/>
			</p>
			<dl class="facts">
				<div>
					<dt>Safe per day</dt>
					<dd>{perDay == null ? '—' : formatMoney(perDay)}</dd>
				</div>
				<div>
					<dt>Spent today</dt>
					<dd><Money value={spentToday} /></dd>
				</div>
				<div>
					<dt>Days left</dt>
					<dd>{daysLeft}</dd>
				</div>
			</dl>
		</section>

		<section class="panel c7" aria-labelledby="pace-h">
			<div class="panel-h">
				<h2 id="pace-h">Spending pace</h2>
				<div class="legend" style:margin-left="auto">
					<span><i class="ln" style:--c="var(--ink)"></i>{monthName}</span>
					<span><i class="ln" style:--c="var(--muted-series)"></i>{data.prior.label}</span>
					{#if hasBasis}<span><i class="dash" style:--c="var(--ink-3)"></i>Even pace</span>{/if}
				</div>
			</div>
			<div class="panel-b">
				<PaceChart
					daily={data.daily}
					priorDaily={data.priorDaily}
					days={data.daysInMonth}
					priorDays={data.priorDaysInMonth}
					today={data.day}
					allocated={hasBasis ? allocated : null}
					year={s.year}
					month={s.month}
					priorLabel={data.prior.label}
				/>
			</div>
		</section>
	</div>

	<div class="kpis">
		<Kpi label="Income" spark={trend.map((t) => t.income)}>
			<!-- Green only ever arrives with a sign, as it does in every row. -->
			<Money value={s.income} direction="income" />
			{#snippet foot()}
				<Delta current={s.income} previous={data.prior.income} label="vs {data.prior.label}" />
			{/snippet}
		</Kpi>
		<Kpi label="Spent" spark={trend.map((t) => t.spent)}>
			<Money value={data.spent} />
			{#snippet foot()}
				<span>{share(data.spent, s.income)} of income</span>
			{/snippet}
		</Kpi>
		<Kpi label="Net">
			{#if net === 0}<span class="faint">—</span>{:else}<span
					class:neg={net < 0}
					class:pos={net > 0}>{net > 0 ? '+' : ''}{formatMoney(net)}</span
				>{/if}
			{#snippet foot()}
				<span
					>{net > 0
						? 'Kept this month'
						: net < 0
							? 'Spent beyond income'
							: 'Nothing in or out yet'}</span
				>
			{/snippet}
		</Kpi>
		<Kpi label="Lendings out">
			<Money value={data.lendingsOutstanding} />
			{#snippet foot()}
				<span>Principal not yet repaid</span>
			{/snippet}
		</Kpi>
	</div>

	<div class="grid">
		<section class="panel c7" aria-labelledby="buckets-h">
			<div class="panel-h">
				<h2 id="buckets-h">Buckets</h2>
				<a class="more" href="/monthly">Budget <Icon name="arrow-right" size={14} /></a>
			</div>
			<div class="panel-b">
				<div class="buckets">
					{#each s.rows as row (row.bucket)}
						{@const m = meter(row.actual, row.allocated)}
						<div class="bucket-row {row.bucket}">
							<div class="name">
								<span class="bk {row.bucket}">{row.label}</span>
								<small>{row.bp == null ? 'No share' : `${formatBP(row.bp)} of income`}</small>
							</div>
							<Bullet
								actual={row.actual}
								allocated={hasBasis ? row.allocated : null}
								mark={data.day / data.daysInMonth}
								label={m && hasBasis ? `${row.label}: ${m.pct}% used` : undefined}
							/>
							<div class="fig f-spent">
								<Money value={row.actual} />
								<small
									>{hasBasis && row.allocated != null
										? `of ${formatMoney(row.allocated)}`
										: 'spent'}</small
								>
							</div>
							<div class="fig f-left">
								{#if hasBasis && row.remaining != null}
									<span class:neg={row.remaining < 0}>{formatMoney(row.remaining)}</span>
									<small>{row.remaining < 0 ? 'over' : 'left'}</small>
								{:else}
									<span class="faint">—</span>
									<small>left</small>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
			<div class="panel-f bucket-total">
				<span>
					{#if s.period}Split {formatBP(s.period.needsBP)} · {formatBP(s.period.wantsBP)} · {formatBP(
							s.period.investBP
						)}{:else}No split in force{/if}
				</span>
				<span>
					Spent <b><Money value={data.spent} /></b>
					{#if hasBasis}of <b>{formatMoney(allocated)}</b>{/if}
				</span>
			</div>
		</section>

		<section class="panel c5" aria-labelledby="cats-h">
			<div class="panel-h">
				<h2 id="cats-h">Where it went</h2>
				<a class="more" href="/ledger">Ledger <Icon name="arrow-right" size={14} /></a>
			</div>
			<div class="panel-b flush">
				<Ranks
					rows={data.spendByCategory}
					limit={6}
					caption="Spending by category, {monthLabel(s.year, s.month)}"
				/>
			</div>
		</section>
	</div>

	<div class="grid">
		<section class="panel c7" aria-labelledby="recent-h">
			<div class="panel-h ruled">
				<h2 id="recent-h">Recent</h2>
				<a class="more" href="/ledger">All transactions <Icon name="arrow-right" size={14} /></a>
			</div>
			<table class="tbl t-recent">
				<caption class="visually-hidden">The latest transactions</caption>
				<colgroup>
					<col class="c-date" />
					<col />
					<col class="c-bucket" />
					<col class="c-amount" />
				</colgroup>
				<tbody>
					{#each data.recent as t (t.id)}
						<tr>
							<!-- Recent crosses month ends, so a row outside this year carries its own. -->
							<td class="first muted tnum">{shortDate(t.date, s.year)}</td>
							<td class="grow">
								<a class="row-link" href="/ledger/{t.id}" onclick={(e) => edit(e, t)} title="Edit">
									{t.categoryName ?? 'Uncategorised'}{#if t.note}<span class="muted"
											>&nbsp;·&nbsp;{t.note}</span
										>{/if}
								</a>
							</td>
							<td class="bkt">
								{#if t.direction === 'income'}
									<span class="bk income">Income</span>
								{:else}
									<span class="bk {t.bucket}">{BUCKET_LABEL[t.bucket ?? 'needs']}</span>
								{/if}
							</td>
							<td class="num last"><Money value={t.amountPaise} direction={t.direction} /></td>
						</tr>
					{:else}
						<tr><td class="empty" colspan="4">Nothing recorded yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="panel c5" aria-labelledby="goals-h">
			<div class="panel-h">
				<h2 id="goals-h">Goals</h2>
				<span class="meta">{data.goals.length}</span>
			</div>
			<div class="panel-b">
				<div class="goal-list">
					{#each data.goals as g (g.goal.id)}
						{@const m = meter(g.contributed, g.goal.targetPaise)}
						<div class="goal">
							<div class="gname">
								<span>{g.goal.name}</span>
								{#if g.goal.kind === 'pot'}<span class="tag">pot</span>{/if}
							</div>
							<div class="gfig">
								<b><Money value={g.contributed} /></b>
								{#if g.goal.targetPaise}of {formatMoney(g.goal.targetPaise)} · {m?.pct ?? 0}%{/if}
							</div>
							<!-- Past its target a goal is done, not overspent: the bar stops full. -->
							<Bullet
								actual={Math.min(g.contributed, g.goal.targetPaise ?? 0)}
								allocated={g.goal.targetPaise}
								tone="neutral"
								size="thin"
							/>
						</div>
					{:else}
						<p class="empty-note">No goals yet.</p>
					{/each}
				</div>
			</div>
		</section>
	</div>
</div>
