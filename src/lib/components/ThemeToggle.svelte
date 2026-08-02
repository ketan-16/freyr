<!--
  Theme switch as a form action, not client state: it works with JavaScript off
  and survives a hard refresh. The icon shows the destination, the label says it
  out loud. See DESIGN.md § Theming mechanism.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Icon from './Icon.svelte';

	let { theme, class: klass = 'rail-btn' }: { theme: 'light' | 'dark'; class?: string } = $props();

	const next = $derived(theme === 'dark' ? 'light' : 'dark');
	const back = $derived(page.url.pathname + page.url.search);
</script>

<form method="POST" action="/theme">
	<input type="hidden" name="to" value={next} />
	<input type="hidden" name="back" value={back} />
	<button class={klass} type="submit" aria-label="Switch to {next} theme">
		<Icon name={next === 'dark' ? 'moon' : 'sun'} />
		<span class="who">{next === 'dark' ? 'Dark' : 'Light'}</span>
	</button>
</form>
