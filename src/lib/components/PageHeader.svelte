<!--
  Every screen opens the same way: its name, the period or scope it shows, and
  its own controls in the right-hand corner. The bar sticks, so the month
  stepper stays in reach down a long ledger. On a phone it is the app bar: a
  back link for a nested screen, or the way into settings, and the offline
  and sync status when there is any.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import SyncStatus from './SyncStatus.svelte';

	let {
		title,
		sub,
		back,
		children
	}: {
		title: string;
		sub?: string;
		back?: { href: string; label: string };
		children?: Snippet;
	} = $props();
</script>

<header class="ph">
	{#if back}
		<a class="ph-back" href={back.href}><Icon name="chevron-left" />{back.label}</a>
	{/if}
	<div class="ph-title">
		<h1>{title}</h1>
		{#if sub}<span class="ph-sub">{sub}</span>{/if}
	</div>
	<SyncStatus side="below" />
	{#if !back}
		<a class="ph-gear icon-btn" href="/settings" aria-label="Settings" title="Settings">
			<Icon name="settings" size={18} />
		</a>
	{/if}
	{#if children}<div class="ph-actions">{@render children()}</div>{/if}
</header>
