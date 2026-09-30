<!--
  ⌘K: jump to any screen, any recent month or year, or run an action, without
  reaching for the pointer. Static — it navigates, it never fetches. Typing
  narrows the list; ↑ ↓ move, ↵ runs, Esc closes.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { addMonths, MONTH_NAMES, monthLabel, todayISO } from '$lib/dates';
	import { useUi } from '$lib/ui.svelte';
	import Icon, { type IconName } from './Icon.svelte';

	interface Item {
		group: string;
		label: string;
		icon: IconName;
		keys?: string[];
		/** Extra words that should find it: "aug", "2025-08". */
		terms?: string;
		run: () => void;
	}

	const ui = useUi();
	let dialog = $state<HTMLDialogElement>();
	let pressedBackdrop = false;
	let input = $state<HTMLInputElement>();
	let query = $state('');
	let active = $state(0);

	const go = (href: string) => () => goto(href);
	const submit = (id: string) => () =>
		(document.getElementById(id) as HTMLFormElement | null)?.requestSubmit();

	const base: Item[] = [
		{ group: 'Go to', label: 'Home', icon: 'house', keys: ['G', 'H'], run: go('/') },
		{
			group: 'Go to',
			label: 'Ledger',
			icon: 'arrow-left-right',
			keys: ['G', 'L'],
			terms: 'transactions',
			run: go('/ledger')
		},
		{
			group: 'Go to',
			label: 'Budget',
			icon: 'chart-pie',
			keys: ['G', 'B'],
			terms: 'monthly',
			run: go('/monthly')
		},
		{
			group: 'Go to',
			label: 'Year',
			icon: 'chart-column',
			keys: ['G', 'Y'],
			terms: 'yearly annual',
			run: go('/yearly')
		},
		{
			group: 'Go to',
			label: 'Splits',
			icon: 'sliders-horizontal',
			keys: ['G', 'S'],
			terms: 'policy promotions raise periods',
			run: go('/settings/budget')
		},
		{
			group: 'Go to',
			label: 'Categories',
			icon: 'tags',
			keys: ['G', 'C'],
			run: go('/settings/categories')
		},
		{ group: 'Go to', label: 'Settings', icon: 'settings', run: go('/settings') },
		{
			group: 'Actions',
			label: 'New transaction',
			icon: 'plus',
			keys: ['N'],
			terms: 'add expense income',
			run: () => ui.add()
		},
		{
			group: 'Actions',
			label: 'Switch theme',
			icon: 'moon',
			terms: 'dark light appearance',
			run: submit('theme-form')
		},
		{
			group: 'Actions',
			label: 'Log out',
			icon: 'log-out',
			terms: 'sign out',
			run: submit('logout-form')
		}
	];

	/** The last twelve months and three years, found by typing. */
	function periods(): Item[] {
		const today = todayISO();
		const y = Number(today.slice(0, 4));
		const m = Number(today.slice(5, 7));
		const out: Item[] = [];
		for (let i = 0; i < 12; i++) {
			const at = addMonths(y, m, -i);
			const terms = `${MONTH_NAMES[at.month - 1].slice(0, 3)} ${at.year}-${String(at.month).padStart(2, '0')}`;
			const label = monthLabel(at.year, at.month);
			out.push(
				{
					group: 'Months',
					label: `Budget · ${label}`,
					icon: 'chart-pie',
					terms,
					run: go(`/monthly?year=${at.year}&month=${at.month}`)
				},
				{
					group: 'Months',
					label: `Ledger · ${label}`,
					icon: 'arrow-left-right',
					terms,
					run: go(`/ledger?year=${at.year}&month=${at.month}`)
				}
			);
		}
		for (let yr = y; yr > y - 3; yr--)
			out.push({
				group: 'Years',
				label: `Year · ${yr}`,
				icon: 'chart-column',
				run: go(`/yearly?year=${yr}`)
			});
		return out;
	}

	const results = $derived.by(() => {
		const words = query.toLowerCase().split(/\s+/).filter(Boolean);
		if (!words.length) return base;
		return [...base, ...periods()].filter((item) => {
			const hay = `${item.group} ${item.label} ${item.terms ?? ''}`.toLowerCase();
			return words.every((w) => hay.includes(w));
		});
	});

	$effect(() => {
		const d = dialog;
		if (!d) return;
		if (ui.menuOpen && !d.open) {
			query = '';
			active = 0;
			d.showModal();
			tick().then(() => input?.focus());
		} else if (!ui.menuOpen && d.open) {
			d.close();
		}
	});

	$effect(() => {
		document.getElementById(`cmd-${active}`)?.scrollIntoView({ block: 'nearest' });
	});

	function run(item: Item | undefined): void {
		if (!item) return;
		ui.menuOpen = false;
		item.run();
	}

	function onkeydown(e: KeyboardEvent): void {
		const n = results.length;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (n) active = (active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			run(results[active]);
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<dialog
	bind:this={dialog}
	class="cmd"
	aria-label="Command menu"
	onclose={() => (ui.menuOpen = false)}
	onpointerdown={(e) => (pressedBackdrop = e.target === dialog)}
	onclick={(e) => {
		if (e.target === dialog && pressedBackdrop) ui.menuOpen = false;
	}}
>
	<div class="cmd-in">
		<Icon name="search" />
		<input
			bind:this={input}
			bind:value={query}
			oninput={() => (active = 0)}
			{onkeydown}
			placeholder="Go to a screen, a month, or an action…"
			aria-label="Search commands"
			role="combobox"
			aria-expanded="true"
			aria-controls="cmd-list"
			aria-activedescendant={results.length ? `cmd-${active}` : undefined}
			autocomplete="off"
			spellcheck="false"
		/>
		<kbd>esc</kbd>
	</div>
	<div class="cmd-list" id="cmd-list" role="listbox" aria-label="Commands">
		{#each results as item, i (item.label)}
			{#if i === 0 || results[i - 1].group !== item.group}
				<div class="cmd-group" role="presentation">{item.group}</div>
			{/if}
			<div
				class="cmd-item"
				id="cmd-{i}"
				role="option"
				tabindex="-1"
				aria-selected={i === active}
				onclick={() => run(item)}
				onpointermove={() => (active = i)}
			>
				<Icon name={item.icon} />
				<span>{item.label}</span>
				{#if item.keys}
					<span class="hint"
						>{#each item.keys as k (k)}<kbd>{k}</kbd>{/each}</span
					>
				{/if}
			</div>
		{:else}
			<p class="empty-note">Nothing matches “{query}”.</p>
		{/each}
	</div>
	<div class="cmd-foot" aria-hidden="true">
		<span><kbd>↑</kbd><kbd>↓</kbd> move</span>
		<span><kbd>↵</kbd> open</span>
		<span><kbd>esc</kbd> close</span>
	</div>
</dialog>
