<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import CommandMenu from '$lib/components/CommandMenu.svelte';
	import FreyrMark from '$lib/components/FreyrMark.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import TxnSheet from '$lib/components/TxnSheet.svelte';
	import { isTyping, provideUi, wantsNewTab } from '$lib/ui.svelte';
	import '../app.css';

	let { children, data } = $props();

	const ui = provideUi();

	// A link followed from inside the sheet or the menu leaves them behind.
	beforeNavigate(() => {
		ui.sheetOpen = false;
		ui.menuOpen = false;
	});

	type Link = { href: string; label: string; icon: IconName; key: string; match?: string };

	const nav: Link[] = [
		{ href: '/', label: 'Home', icon: 'house', key: 'h' },
		{ href: '/ledger', label: 'Ledger', icon: 'arrow-left-right', key: 'l' },
		{ href: '/monthly', label: 'Budget', icon: 'chart-pie', key: 'b' },
		{ href: '/yearly', label: 'Year', icon: 'chart-column', key: 'y' }
	];

	const settings: Link[] = [
		{ href: '/settings/budget', label: 'Splits', icon: 'sliders-horizontal', key: 's' },
		{ href: '/settings/categories', label: 'Categories', icon: 'tags', key: 'c' }
	];

	/** `g` then a letter: the same letters the command menu shows. */
	const GO = Object.fromEntries([...nav, ...settings].map((l) => [l.key, l.href]));

	function current(href: string): 'page' | undefined {
		const path = page.url.pathname;
		if (href === '/') return path === '/' ? 'page' : undefined;
		return path === href || path.startsWith(`${href}/`) ? 'page' : undefined;
	}

	/** The add control is a link to the entry bar, so it works with script off. */
	function add(e: MouseEvent): void {
		if (wantsNewTab(e)) return;
		e.preventDefault();
		ui.add();
	}

	let leader = false;
	let leaderTimer: ReturnType<typeof setTimeout> | undefined;

	function onkeydown(e: KeyboardEvent): void {
		if (e.defaultPrevented) return;
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			ui.sheetOpen = false;
			ui.menuOpen = !ui.menuOpen;
			return;
		}
		if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
		if (ui.sheetOpen || ui.menuOpen) return;

		if (leader) {
			leader = false;
			const to = GO[e.key.toLowerCase()];
			if (to) {
				e.preventDefault();
				goto(to);
			}
			return;
		}
		if (e.key === 'g') {
			leader = true;
			clearTimeout(leaderTimer);
			leaderTimer = setTimeout(() => (leader = false), 1200);
		} else if (e.key === 'n') {
			e.preventDefault();
			ui.add();
		} else if (e.key === '/') {
			e.preventDefault();
			const search = document.querySelector<HTMLInputElement>('[data-search]');
			if (search) search.focus();
			else ui.menuOpen = true;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<!-- The browser chrome matches the surface the top of every screen sits on;
	     with no theme chosen, the OS decides that too. -->
	{#if data.themeChosen}
		<meta name="theme-color" content={data.theme === 'dark' ? '#111113' : '#ffffff'} />
	{:else}
		<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
		<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#111113" />
	{/if}
	<title>Freyr</title>
</svelte:head>

<svelte:window {onkeydown} />

{#if data.user}
	<a class="skip" href="#main">Skip to content</a>
	<div class="progress" class:on={navigating.to != null} aria-hidden="true"></div>

	<div class="app">
		<aside class="side">
			<div class="side-in">
				<a class="brand" href="/" aria-label="Freyr, home">
					<FreyrMark size={22} />
					<span class="wordmark">Freyr</span>
				</a>

				<button
					class="side-search"
					type="button"
					onclick={() => (ui.menuOpen = true)}
					title="Search and jump  ⌘K"
				>
					<Icon name="search" />
					<span class="lbl">Jump to…</span>
					<kbd>⌘K</kbd>
				</button>
				<a class="side-new" href="/ledger#new" onclick={add} title="New transaction  N">
					<span class="ico"><Icon name="plus" size={14} stroke={2.25} /></span>
					<span class="lbl">New transaction</span>
					<kbd>N</kbd>
				</a>

				<nav aria-label="Main">
					{#each nav as item (item.href)}
						<a
							class="nav-item"
							href={item.href}
							aria-current={current(item.href)}
							title="{item.label}  G {item.key.toUpperCase()}"
						>
							<Icon name={item.icon} />
							<span>{item.label}</span>
						</a>
					{/each}

					<p class="nav-label">Settings</p>
					{#each settings as item (item.href)}
						<a
							class="nav-item"
							href={item.href}
							aria-current={current(item.href)}
							title="{item.label}  G {item.key.toUpperCase()}"
						>
							<Icon name={item.icon} />
							<span>{item.label}</span>
						</a>
					{/each}
				</nav>

				<div class="side-spacer"></div>

				<div class="side-foot">
					<a class="avatar" href="/settings" aria-label="Settings" title="Settings"
						>{data.user.username.slice(0, 1)}</a
					>
					<span class="who">{data.user.username}</span>
					<ThemeToggle theme={data.theme} id="theme-form" />
					<form method="POST" action="/logout" id="logout-form">
						<button
							class="icon-btn"
							type="submit"
							aria-label="Log out {data.user.username}"
							title="Log out"
						>
							<Icon name="log-out" />
						</button>
					</form>
				</div>
			</div>
		</aside>

		<main id="main" class="main">
			{@render children()}
		</main>

		<nav class="tabbar" aria-label="Main">
			{#each nav.slice(0, 2) as item (item.href)}
				<a href={item.href} aria-current={current(item.href)}>
					<Icon name={item.icon} size={20} />
					<span>{item.label}</span>
				</a>
			{/each}
			<a href="/ledger#new" onclick={add} aria-label="New transaction">
				<span class="add"><Icon name="plus" size={20} stroke={2.25} /></span>
			</a>
			{#each nav.slice(2) as item (item.href)}
				<a href={item.href} aria-current={current(item.href)}>
					<Icon name={item.icon} size={20} />
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
	</div>

	<TxnSheet categories={data.entryCategories} />
	<CommandMenu />

	<div class="toasts" role="status" aria-live="polite">
		{#each ui.toasts as t (t.id)}
			<div class="toast">
				<Icon name="circle-check" />
				<span>{t.text}</span>
			</div>
		{/each}
	</div>
{:else}
	{@render children()}
{/if}
