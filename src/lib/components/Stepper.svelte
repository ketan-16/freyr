<!--
  ‹ September 2026 › — the period a screen shows, one step either way, and an
  optional picker for a longer jump. The picker is a native popover, so it
  opens, traps nothing and light-dismisses with no script; script only anchors
  it under its button. `[` and `]` step from anywhere on the page that is not
  a field being typed in.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { isTyping } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';

	type Step = { href: string; label: string } | null;

	let {
		label,
		prev,
		next,
		unit,
		picker
	}: {
		label: string;
		prev: Step;
		next: Step;
		/** What one step is, for the arrows' names: "month", "year". */
		unit: string;
		picker?: Snippet<[close: () => void]>;
	} = $props();

	const id = $props.id();
	let pop = $state<HTMLElement>();
	let button = $state<HTMLButtonElement>();

	/** Anchor the popover under its button; the top layer is viewport-fixed. */
	function place(): void {
		if (!pop || !button) return;
		const r = button.getBoundingClientRect();
		const width = 240;
		const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), innerWidth - width - 8);
		pop.style.inset = 'auto';
		pop.style.margin = '0';
		pop.style.top = `${r.bottom + 6}px`;
		pop.style.left = `${left}px`;
	}

	$effect(() => {
		const el = pop;
		if (!el) return;
		const onToggle = (e: Event) => {
			if ((e as ToggleEvent).newState === 'open') place();
		};
		el.addEventListener('beforetoggle', onToggle);
		return () => el.removeEventListener('beforetoggle', onToggle);
	});

	function close(): void {
		pop?.hidePopover();
	}

	function onkeydown(e: KeyboardEvent): void {
		if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
		// A modal owns the keyboard while it is open.
		if (document.querySelector('dialog[open]')) return;
		const to = e.key === '[' ? prev : e.key === ']' ? next : null;
		if (!to) return;
		e.preventDefault();
		goto(to.href, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:window {onkeydown} />

<div class="stepper" role="group" aria-label={unit === 'year' ? 'Year' : 'Month'}>
	{#if prev}
		<a href={prev.href} aria-label="Previous {unit}, {prev.label}" title="Previous {unit}  [">
			<Icon name="chevron-left" />
		</a>
	{:else}
		<span class="off" aria-hidden="true"><Icon name="chevron-left" /></span>
	{/if}
	{#if picker}
		<button
			class="label"
			type="button"
			bind:this={button}
			popovertarget="{id}-pop"
			aria-label="{label}, choose another {unit}"
		>
			{label}<Icon name="chevron-down" size={14} />
		</button>
	{:else}
		<span class="label static">{label}</span>
	{/if}
	{#if next}
		<a href={next.href} aria-label="Next {unit}, {next.label}" title="Next {unit}  ]">
			<Icon name="chevron-right" />
		</a>
	{:else}
		<span class="off" aria-hidden="true"><Icon name="chevron-right" /></span>
	{/if}
</div>

{#if picker}
	<div class="picker" id="{id}-pop" popover="auto" bind:this={pop}>
		{@render picker(close)}
	</div>
{/if}
