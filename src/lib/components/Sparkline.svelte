<!--
  A trend and nothing else: no axes, no fill, no tooltip. If a value matters
  enough to inspect, it belongs in a table. `values` run oldest to newest, and
  the line spans their own range — a sparkline shows shape, not magnitude.
-->
<script lang="ts">
	import { linePath, pct } from '$lib/chart';

	let { values, label }: { values: number[]; label: string } = $props();

	const d = $derived.by(() => {
		// No history to show a shape of: draw nothing rather than a flat line.
		if (values.length < 2 || values.every((v) => v === 0)) return '';
		const low = Math.min(...values);
		const span = Math.max(...values) - low;
		return linePath(
			values.map((v, i) => [
				(i / (values.length - 1)) * 100,
				span === 0 ? 50 : pct(v - low, span) * 0.84 + 8
			])
		);
	});
</script>

{#if d}
	<svg class="spark" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label}>
		<path {d} />
	</svg>
{/if}
