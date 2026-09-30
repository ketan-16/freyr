<!--
  One money figure under the money-cell convention: zero is an em dash, an
  inflow is signed and green, an outflow is bare. `compact` prints ₹1.2L for a
  tight label; the exact figure then rides in the title.
-->
<script lang="ts">
	import { formatCell, formatCompact, type Flow } from '$lib/format';
	import { formatMoney, type Paise } from '$lib/money';

	let {
		value,
		direction,
		compact = false
	}: { value: Paise; direction?: Flow; compact?: boolean } = $props();

	const text = $derived.by(() => {
		if (!compact || value === 0) return formatCell(value, direction);
		const short = formatCompact(value);
		return direction === 'income' && value > 0 ? `+${short}` : short;
	});
</script>

<span
	class:pos={direction === 'income' && value > 0}
	class:faint={value === 0}
	title={compact && value !== 0 ? formatMoney(value) : undefined}>{text}</span
>
