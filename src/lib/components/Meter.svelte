<!--
  The progress track. Under the cap it is one fill; over it the track rescales
  so the allocation and the excess are both visible, split by a hairline. Always
  rendered beside a text figure — the bar is a glance, the number is the truth.
-->
<script lang="ts">
	import type { Meter } from '$lib/progress';

	let { value }: { value: Meter | null } = $props();
</script>

{#if value}
	<span class="meter {value.klass}">
		<span class="fill" style="width:{value.width}%"></span>
		{#if value.overflow > 0}
			<span class="over-seg" style="width:{value.overflow}%"></span>
		{/if}
	</span>
{:else}
	<span class="faint">—</span>
{/if}
