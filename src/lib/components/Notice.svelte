<!--
  One notice line. `info` explains a state the screen is in and asks nothing;
  `warn` is the caution tone and names a remedy. The icon repeats the tone so
  it never rides on colour alone.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let { tone = 'info', children }: { tone?: 'info' | 'warn'; children: Snippet } = $props();
</script>

<p class="notice {tone}">
	<Icon name={tone === 'warn' ? 'triangle-alert' : 'info'} />
	<span>{@render children()}</span>
</p>
