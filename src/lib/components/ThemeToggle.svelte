<!--
  The sidebar's theme control: one button showing the current setting, which
  opens the three choices as a small menu. The menu is a native popover, so it
  opens and light-dismisses with script off, and each choice is still a plain
  post; script only anchors it above the button.
-->
<script lang="ts">
	import { anchorPopover, useUi } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import ThemeSwitch from './ThemeSwitch.svelte';

	const ui = useUi();
	const id = $props.id();
	let pop = $state<HTMLElement>();
	let button = $state<HTMLButtonElement>();

	const ICON = { system: 'monitor', light: 'sun', dark: 'moon' } as const;
	const NAME = { system: 'System', light: 'Light', dark: 'Dark' } as const;

	$effect(() => {
		const el = pop;
		if (!el) return;
		const onToggle = (e: Event) => {
			// Above the button: it sits at the foot of the sidebar. 160px is .theme-pop's width.
			if ((e as ToggleEvent).newState === 'open' && button)
				anchorPopover(el, button, { width: 160, side: 'above', align: 'start' });
		};
		el.addEventListener('beforetoggle', onToggle);
		return () => el.removeEventListener('beforetoggle', onToggle);
	});
</script>

<button
	class="icon-btn"
	type="button"
	bind:this={button}
	popovertarget="{id}-theme"
	aria-label="Theme: {NAME[ui.theme]}"
	title="Theme: {NAME[ui.theme]}"
>
	<Icon name={ICON[ui.theme]} />
</button>
<div class="picker theme-pop" id="{id}-theme" popover="auto" bind:this={pop}>
	<ThemeSwitch menu onchoose={() => pop?.hidePopover()} />
</div>
