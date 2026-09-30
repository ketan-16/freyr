<script lang="ts">
	import DailyChart from '$lib/components/DailyChart.svelte';
	import EntryBar from '$lib/components/EntryBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import MonthNav from '$lib/components/MonthNav.svelte';
	import Money from '$lib/components/Money.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { dayLabel, daysInMonth, monthLabel } from '$lib/dates';
	import { formatCell } from '$lib/format';
	import { formatMoney, toAmountInput } from '$lib/money';
	import type { DayTotals } from '$lib/server/insights';
	import type { Bucket, Txn } from '$lib/server/ledger';
	import { useUi, wantsNewTab } from '$lib/ui.svelte';

	let { data, form } = $props();

	const ui = useUi();
	const f = $derived(data.filters);

	const BUCKETS: [Bucket, string][] = [
		['needs', 'Needs'],
		['wants', 'Wants'],
		['investments', 'Investments']
	];

	/** A ledger URL that keeps whichever filter is not being changed. */
	function link(year: number, month: number, bucket: Bucket | undefined = f.bucket): string {
		return `/ledger?year=${year}&month=${month}${bucket ? `&bucket=${bucket}` : ''}`;
	}

	/** Actions post with the filters, so the redirect lands back on this view. */
	const scope = $derived(link(f.year, f.month).slice('/ledger?'.length));

	let query = $state('');
	const needle = $derived(query.trim().toLowerCase());

	/** Everything a row can be found by: what it was, the note, the bucket, the figure. */
	function haystack(t: Txn): string {
		return [
			t.categoryName ?? 'uncategorised',
			t.note ?? '',
			t.bucket ?? `income ${t.incomeSource === 'side_hustle' ? 'side hustle' : t.incomeSource}`,
			formatMoney(t.amountPaise),
			toAmountInput(t.amountPaise)
		]
			.join(' ')
			.toLowerCase();
	}

	const shown = $derived(
		needle ? data.transactions.filter((t) => haystack(t).includes(needle)) : data.transactions
	);

	/** Statement order: one group per day, newest first, each with its totals. */
	const days = $derived.by(() => {
		const out: { date: string; rows: Txn[]; out: number; in: number }[] = [];
		for (const t of shown) {
			let g = out.at(-1);
			if (!g || g.date !== t.date) out.push((g = { date: t.date, rows: [], out: 0, in: 0 }));
			g.rows.push(t);
			if (t.direction === 'income') g.in += t.amountPaise;
			else g.out += t.amountPaise;
		}
		return out;
	});

	const totals = $derived.by(() => {
		let inn = 0;
		let out = 0;
		for (const t of data.transactions) {
			if (t.direction === 'income') inn += t.amountPaise;
			else out += t.amountPaise;
		}
		return { in: inn, out };
	});

	/** The strip above the table, from the rows already here — no second query. */
	const daily = $derived.by(() => {
		const by: DayTotals[] = [];
		for (const t of data.transactions) {
			if (t.direction !== 'outflow') continue;
			const day = Number(t.date.slice(8, 10));
			const d = (by[day] ??= { day, income: 0, needs: 0, wants: 0, invest: 0 });
			if (t.bucket === 'needs') d.needs += t.amountPaise;
			else if (t.bucket === 'wants') d.wants += t.amountPaise;
			else d.invest += t.amountPaise;
		}
		return by.filter(Boolean);
	});

	const isCurrent = $derived(
		f.year === Number(data.today.slice(0, 4)) && f.month === Number(data.today.slice(5, 7))
	);
	const count = $derived(data.transactions.length);

	function open(e: MouseEvent, t: Txn): void {
		if (wantsNewTab(e)) return;
		e.preventDefault();
		ui.edit(t);
	}

	/** The whole row opens the sheet; its link is the keyboard's way in. */
	function rowClick(e: MouseEvent, t: Txn): void {
		if ((e.target as HTMLElement).closest('a, button')) return;
		ui.edit(t);
	}
</script>

<svelte:head>
	<title>Ledger — Freyr</title>
</svelte:head>

<PageHeader title="Ledger" sub="{count} {count === 1 ? 'entry' : 'entries'}">
	<MonthNav year={f.year} month={f.month} today={data.today} href={(y, m) => link(y, m)} />
</PageHeader>

<div class="page">
	<div class="toolbar">
		<nav class="seg" aria-label="Bucket">
			<a href={link(f.year, f.month, undefined)} aria-current={f.bucket ? undefined : 'true'}>All</a
			>
			{#each BUCKETS as [b, name] (b)}
				<a href={link(f.year, f.month, b)} aria-current={f.bucket === b ? 'true' : undefined}>
					<i class="sw {b}"></i>{name}
				</a>
			{/each}
		</nav>
		<div class="search">
			<Icon name="search" size={14} />
			<input
				type="search"
				bind:value={query}
				placeholder="Filter {monthLabel(f.year, f.month)}"
				aria-label="Filter these transactions"
				data-search
			/>
			<kbd>/</kbd>
		</div>
		<div class="stats" style:margin-left="auto">
			<span>In<b class:pos={totals.in > 0}>{formatCell(totals.in, 'income')}</b></span>
			<span>Out<b>{formatCell(totals.out)}</b></span>
		</div>
	</div>

	<section class="panel" aria-label="Transactions, {monthLabel(f.year, f.month)}">
		<div class="panel-b ledger-strip">
			<DailyChart
				{daily}
				year={f.year}
				month={f.month}
				days={daysInMonth(f.year, f.month)}
				today={isCurrent ? Number(data.today.slice(8, 10)) : null}
				href={(d) => `#day-${d}`}
				compact
			/>
		</div>

		<EntryBar
			action="?/create&{scope}"
			entry={data.entry}
			values={form?.values}
			error={form?.error}
		/>

		<table class="tbl t-txn">
			<thead>
				<tr>
					<th scope="col" class="first">Category</th>
					<th scope="col" class="grow">Note</th>
					<th scope="col">Bucket</th>
					<th scope="col" class="num last">Amount</th>
				</tr>
			</thead>
			{#each days as g (g.date)}
				<tbody class="day" id="day-{Number(g.date.slice(8, 10))}">
					<tr class="dayrow">
						<th scope="rowgroup" colspan="4" class="first last">
							{dayLabel(g.date, f.year)}
							<span class="dtot">
								{#if g.in}<span class="pos">{formatCell(g.in, 'income')}</span>{/if}
								{#if g.in && g.out}&nbsp;·&nbsp;{/if}
								{#if g.out}{formatCell(g.out)}{/if}
							</span>
						</th>
					</tr>
					{#each g.rows as t (t.id)}
						<!-- The category link is the keyboard's way into the same sheet. -->
						<tr class="click" onclick={(e) => rowClick(e, t)}>
							<td class="cat first">
								<a class="edit" href="/ledger/{t.id}?{scope}" onclick={(e) => open(e, t)}>
									{#if t.categoryName}{t.categoryName}{:else}<span class="un">Uncategorised</span
										>{/if}
								</a>
							</td>
							<td class="note grow">{t.note ?? ''}</td>
							<td class="bkt">
								{#if t.direction === 'income'}
									<span class="bk income"
										>Income · {t.incomeSource === 'side_hustle'
											? 'side hustle'
											: t.incomeSource}</span
									>
								{:else}
									<span class="bk {t.bucket}"
										>{BUCKETS.find(([b]) => b === t.bucket)?.[1] ?? t.bucket}</span
									>
								{/if}
								{#if t.note}<span class="note-m phone-only">{t.note}</span>{/if}
							</td>
							<td class="num amt last"><Money value={t.amountPaise} direction={t.direction} /></td>
						</tr>
					{/each}
				</tbody>
			{:else}
				<tbody>
					<tr>
						<td class="empty" colspan="4">
							{needle
								? `Nothing this month matches “${query.trim()}”.`
								: `No transactions in ${monthLabel(f.year, f.month)}.`}
						</td>
					</tr>
				</tbody>
			{/each}
		</table>
	</section>
</div>
