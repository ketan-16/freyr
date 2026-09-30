<!--
  One figure in a KPI strip: a label, the value, an optional line under it (a
  delta, a context) and an optional sparkline of the months before.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Sparkline from './Sparkline.svelte';

	let {
		label,
		children,
		foot,
		spark
	}: {
		label: string;
		children: Snippet;
		foot?: Snippet;
		spark?: number[];
	} = $props();
</script>

<div class="kpi">
	<span class="kpi-label">{label}</span>
	<div class="kpi-row">
		<div class="kpi-value">{@render children()}</div>
		{#if spark}<Sparkline values={spark} label="{label}, last {spark.length} months" />{/if}
	</div>
	{#if foot}<div class="kpi-foot">{@render foot()}</div>{/if}
</div>
