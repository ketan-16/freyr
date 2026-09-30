<!--
  Where the money went, largest first: each category with a bar in its bucket's
  hue, the figure and its share. Past `limit` the tail folds into one "Other"
  line rather than inventing more rows or more colours.
-->
<script lang="ts">
	import { share } from '$lib/format';
	import { formatMoney } from '$lib/money';
	import type { CategoryTotal } from '$lib/server/insights';

	let {
		rows,
		limit = 6,
		caption,
		empty = 'Nothing spent yet.'
	}: { rows: CategoryTotal[]; limit?: number; caption: string; empty?: string } = $props();

	const BUCKET_NAMES = { needs: 'needs', wants: 'wants', investments: 'investments' } as const;

	const total = $derived(rows.reduce((t, r) => t + r.total, 0));
	const shown = $derived.by(() => {
		const top = rows.slice(0, limit).map((r) => ({
			key: `${r.bucket}:${r.categoryId}`,
			name: r.name ?? `Uncategorised ${BUCKET_NAMES[r.bucket]}`,
			named: r.name != null,
			bucket: r.bucket as string,
			total: r.total
		}));
		const rest = rows.slice(limit);
		if (rest.length)
			top.push({
				key: 'other',
				name: `${rest.length} more`,
				named: false,
				bucket: 'rest',
				total: rest.reduce((t, r) => t + r.total, 0)
			});
		return top;
	});
	const max = $derived(Math.max(1, ...shown.map((r) => r.total)));
</script>

<table class="tbl ranks">
	<caption class="visually-hidden">{caption}</caption>
	<tbody>
		{#each shown as r (r.key)}
			<tr>
				<th scope="row" class="rk-name first">
					<span class="bk {r.bucket}" class:dim={!r.named}>{r.name}</span>
				</th>
				<td class="rk-bar grow" aria-hidden="true">
					<span class={r.bucket} style:width="{(r.total / max) * 100}%"></span>
				</td>
				<td class="num">{formatMoney(r.total)}</td>
				<td class="num rk-pct last">{share(r.total, total)}</td>
			</tr>
		{:else}
			<tr><td class="empty" colspan="4">{empty}</td></tr>
		{/each}
	</tbody>
</table>
