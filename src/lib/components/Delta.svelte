<!--
  A signed change across three redundant channels — arrow, colour and sign — so
  the meaning survives colour blindness and grayscale (DESIGN.md § delta-cell).
  The arrow is aria-hidden because the signed text already says it out loud.
-->
<script lang="ts">
	import { delta } from '$lib/format';
	import type { Paise } from '$lib/money';

	let {
		current,
		previous,
		lowerIsBetter = false,
		label
	}: { current: Paise; previous: Paise; lowerIsBetter?: boolean; label?: string } = $props();

	const d = $derived(delta(current, previous, { lowerIsBetter }));
</script>

<span class="delta {d.klass}">
	<span aria-hidden="true">{d.arrow}</span>{d.text}{#if label}<span class="muted">{label}</span
		>{/if}
</span>
