<!--
  Theme switch as a form action, not client state: it works with JavaScript off
  and survives a hard refresh. With no cookie set the OS decides the theme, and
  the server cannot see which — so once the page runs, the target is read from
  what is actually on screen. The icon shows the destination; the label says it.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Icon from './Icon.svelte';

	let {
		theme,
		withLabel = false,
		id
	}: { theme: 'light' | 'dark'; withLabel?: boolean; id?: string } = $props();

	let shown = $state<'light' | 'dark' | null>(null);
	onMount(() => {
		const stamped = document.documentElement.dataset.theme;
		shown =
			stamped === 'dark' || stamped === 'light'
				? stamped
				: matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light';
	});

	const next = $derived((shown ?? theme) === 'dark' ? 'light' : 'dark');
	const back = $derived(page.url.pathname + page.url.search);
</script>

<form method="POST" action="/theme" {id}>
	<input type="hidden" name="to" value={next} />
	<input type="hidden" name="back" value={back} />
	{#if withLabel}
		<button class="btn" type="submit">
			<Icon name={next === 'dark' ? 'moon' : 'sun'} />Use {next} theme
		</button>
	{:else}
		<button
			class="icon-btn"
			type="submit"
			aria-label="Switch to {next} theme"
			title="Switch to {next} theme"
		>
			<Icon name={next === 'dark' ? 'moon' : 'sun'} />
		</button>
	{/if}
</form>
