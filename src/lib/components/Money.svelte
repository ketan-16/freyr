<!--
  A money figure carrying DESIGN.md's money-cell convention: zero is an em dash
  in --ink-faint, an inflow is signed and green, an outflow is bare. The cell
  itself keeps `class="num amount"`; this owns only the value.
-->
<script lang="ts">
	import { formatCell, type Flow } from '$lib/format';
	import type { Paise } from '$lib/money';

	let { value, direction }: { value: Paise; direction?: Flow } = $props();
</script>

<span class:pos={direction === 'income' && value > 0} class:faint={value === 0}
	>{formatCell(value, direction)}</span
>
