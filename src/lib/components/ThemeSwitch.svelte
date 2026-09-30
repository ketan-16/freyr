<!--
  The theme setting: System, Light or Dark. A form of three submit buttons, so
  with script off each one is a plain post to /theme and back again; with it,
  the choice lands on the page at once and the cookie is written behind it.
  `menu` lays the three out as a list (the sidebar's popover) instead of a
  segmented control (Settings).
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { ThemeChoice } from '$lib/theme';
	import { useUi } from '$lib/ui.svelte';
	import Icon, { type IconName } from './Icon.svelte';

	let { menu = false, onchoose }: { menu?: boolean; onchoose?: () => void } = $props();

	const ui = useUi();

	const CHOICES: { value: ThemeChoice; label: string; icon: IconName }[] = [
		{ value: 'system', label: 'System', icon: 'monitor' },
		{ value: 'light', label: 'Light', icon: 'sun' },
		{ value: 'dark', label: 'Dark', icon: 'moon' }
	];

	const back = $derived(page.url.pathname + page.url.search);

	function onsubmit(e: SubmitEvent): void {
		const to = (e.submitter as HTMLButtonElement | null)?.value;
		if (to !== 'system' && to !== 'light' && to !== 'dark') return;
		e.preventDefault();
		ui.setTheme(to);
		onchoose?.();
	}
</script>

<form method="POST" action="/theme" {onsubmit}>
	<input type="hidden" name="back" value={back} />
	<div class={menu ? 'menu-list' : 'seg'} role="group" aria-label="Theme">
		{#each CHOICES as c (c.value)}
			<button type="submit" name="to" value={c.value} aria-pressed={ui.theme === c.value}>
				<Icon name={c.icon} size={14} />
				<span>{c.label}</span>
				{#if menu && ui.theme === c.value}<Icon name="check" size={14} />{/if}
			</button>
		{/each}
	</div>
</form>
