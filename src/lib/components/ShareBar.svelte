<!--
  A whole split three ways — the needs/wants/investments shares of a budget
  period — with a surface gap between parts. The legend beside it carries the
  names and figures; the bar is the proportion.
-->
<script lang="ts">
	let {
		parts,
		tall = false,
		label
	}: {
		parts: { key: string; value: number }[];
		tall?: boolean;
		label?: string;
	} = $props();
</script>

<div class="share-bar" class:tall role={label ? 'img' : undefined} aria-label={label}>
	{#each parts as p (p.key)}
		{#if p.value > 0}<span class={p.key} style:flex-grow={p.value}></span>{/if}
	{/each}
</div>
