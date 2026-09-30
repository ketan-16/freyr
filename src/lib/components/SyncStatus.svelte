<!--
  Offline and sync, said only when there is something to say: offline, writes
  waiting, a sync running, a write the server refused, or a sign-in needed
  before the queue can drain. All quiet, it renders nothing. The chip opens a
  popover listing each waiting or refused write, with Retry and Discard.
  One sits at the foot of the sidebar, one in the phone's app bar.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { describeWrite, type SyncItem } from '$lib/offline';
	import { useSync } from '$lib/sync.svelte';
	import { anchorPopover } from '$lib/ui.svelte';
	import Icon, { type IconName } from './Icon.svelte';

	let { side }: { side: 'above' | 'below' } = $props();

	const sync = useSync();
	const id = $props.id();
	let pop = $state<HTMLElement>();
	let button = $state<HTMLButtonElement>();

	const chip = $derived.by((): { icon: IconName; label: string; warn?: boolean } | null => {
		if (!sync.active) return null;
		const waiting = sync.pending.length;
		if (sync.needsAuth) return { icon: 'cloud-alert', label: 'Sign in to sync', warn: true };
		if (sync.failed.length)
			return { icon: 'cloud-alert', label: `${sync.failed.length} not saved`, warn: true };
		if (!sync.online)
			return { icon: 'cloud-off', label: waiting ? `Offline · ${waiting} waiting` : 'Offline' };
		if (sync.syncing) return { icon: 'refresh-cw', label: 'Syncing…' };
		if (waiting) return { icon: 'refresh-cw', label: `${waiting} waiting` };
		return null;
	});

	const summary = $derived(
		sync.needsAuth
			? 'Your session ended. Sign in and what waits here is sent in the order you made it.'
			: !sync.online
				? 'Freyr can’t be reached. You’re seeing what this device last saved; anything you change waits here and goes when the connection is back.'
				: sync.pending.length
					? 'Sending what you changed offline, oldest first.'
					: 'Freyr refused these. Nothing else is held up by them.'
	);

	/** Category ids → names, from the layout's list, for the labels. */
	const names = $derived(
		new Map<string, string>(
			(page.data.entryCategories ?? []).map((c: { id: number; name: string }) => [
				String(c.id),
				c.name
			])
		)
	);
	const label = (item: SyncItem) => describeWrite(item, (cid) => names.get(cid));
	const time = (at: number) =>
		new Date(at).toLocaleString('en-IN', {
			day: 'numeric',
			month: 'short',
			hour: 'numeric',
			minute: '2-digit'
		});

	$effect(() => {
		const el = pop;
		if (!el) return;
		const onToggle = (e: Event) => {
			// 288px is .sync-pop's width (18rem).
			if ((e as ToggleEvent).newState === 'open' && button)
				anchorPopover(el, button, {
					width: 288,
					side,
					align: side === 'above' ? 'start' : 'center'
				});
		};
		el.addEventListener('beforetoggle', onToggle);
		return () => el.removeEventListener('beforetoggle', onToggle);
	});
</script>

{#if chip}
	<button
		class="sync-chip"
		class:warn={chip.warn}
		class:spin={sync.syncing}
		type="button"
		bind:this={button}
		popovertarget="{id}-sync"
		title={chip.label}
	>
		<Icon name={chip.icon} size={14} />
		<span>{chip.label}</span>
	</button>
	<div class="picker sync-pop" id="{id}-sync" popover="auto" bind:this={pop}>
		<p class="sync-lead">{summary}</p>
		{#if sync.needsAuth}
			<a class="btn block" href="/login">Sign in</a>
		{/if}
		{#if sync.failed.length}
			<h3>Not saved</h3>
			<ul class="sync-list">
				{#each sync.failed as item (item.id)}
					<li>
						<span class="what">{label(item)}</span>
						<span class="why">{item.error}</span>
						<span class="acts">
							<button
								class="btn ghost"
								type="button"
								onclick={() => sync.send({ type: 'retry', id: item.id })}
							>
								Retry
							</button>
							<button
								class="btn ghost"
								type="button"
								onclick={() => sync.send({ type: 'discard', id: item.id })}
							>
								Discard
							</button>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
		{#if sync.pending.length}
			<h3>Waiting to sync</h3>
			<ul class="sync-list">
				{#each sync.pending as item (item.id)}
					<li>
						<span class="what">{label(item)}</span>
						<span class="why tnum">{time(item.at)}</span>
						<span class="acts">
							<button
								class="btn ghost"
								type="button"
								aria-label="Discard: {label(item)}"
								onclick={() => sync.send({ type: 'discard', id: item.id })}
							>
								Discard
							</button>
						</span>
					</li>
				{/each}
			</ul>
			{#if sync.online && !sync.syncing}
				<button class="btn block" type="button" onclick={() => sync.send({ type: 'sync' })}>
					<Icon name="refresh-cw" />Sync now
				</button>
			{/if}
		{/if}
	</div>
{/if}
