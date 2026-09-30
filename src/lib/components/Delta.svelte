<!--
  A signed change across three redundant channels — arrow, colour and sign — so
  the meaning survives colour blindness and grayscale (DESIGN.md § Figures). The
  arrow reports which way the figure moved; the colour, whether that is good.
  Flat is a single em dash with no arrow.
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
	<span class="dv"
		>{#if d.klass !== 'flat'}<span class="arrow" aria-hidden="true">{d.arrow}</span
			>{/if}{d.text}</span
	>{#if label}<span class="ctx">{label}</span>{/if}
</span>
