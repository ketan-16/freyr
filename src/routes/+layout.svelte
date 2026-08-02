<script lang="ts">
	import { page } from '$app/state';
	import FreyrMark from '$lib/components/FreyrMark.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import '../app.css';

	let { children, data } = $props();

	const nav = [
		{ href: '/', label: 'Home', icon: 'home' },
		{ href: '/ledger', label: 'Ledger', icon: 'list' },
		{ href: '/monthly', label: 'Monthly', icon: 'calendar' },
		{ href: '/yearly', label: 'Yearly', icon: 'calendar-range' }
	];

	const settings = [{ href: '/settings/budget', label: 'Budget', icon: 'sliders' }];

	function current(href: string): 'page' | undefined {
		if (href === '/') return page.url.pathname === '/' ? 'page' : undefined;
		return page.url.pathname.startsWith(href) ? 'page' : undefined;
	}
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<meta name="theme-color" content={data.theme === 'dark' ? '#16241d' : '#2c4a3b'} />
	<title>Freyr</title>
</svelte:head>

{#if data.user}
	<a class="skip-link" href="#main">Skip to content</a>

	<div class="shell">
		<header class="topbar">
			<span class="wordmark"><FreyrMark size={18} />FREYR</span>
			<ThemeToggle theme={data.theme} class="" />
		</header>

		<nav class="rail" aria-label="Main">
			<a class="rail-brand" href="/">
				<FreyrMark size={26} />
				<span class="wordmark">FREYR</span>
			</a>

			{#each nav as item (item.href)}
				<a class="rail-item" href={item.href} aria-current={current(item.href)} title={item.label}>
					<Icon name={item.icon} />
					<span>{item.label}</span>
				</a>
			{/each}

			<p class="rail-section">Settings</p>
			{#each settings as item (item.href)}
				<a class="rail-item" href={item.href} aria-current={current(item.href)} title={item.label}>
					<Icon name={item.icon} />
					<span>{item.label}</span>
				</a>
			{/each}

			<div class="rail-spacer"></div>

			<div class="rail-foot">
				<ThemeToggle theme={data.theme} />
				<form method="POST" action="/logout">
					<button class="rail-btn grow" type="submit" title="Log out ({data.user.username})">
						<Icon name="log-out" />
						<span class="who">{data.user.username}</span>
					</button>
				</form>
			</div>
		</nav>

		<main id="main">
			<div class="page">
				{@render children()}
			</div>
		</main>

		<nav class="tabbar" aria-label="Main">
			{#each [...nav, ...settings] as item (item.href)}
				<a href={item.href} aria-current={current(item.href)}>
					<Icon name={item.icon} size={18} />
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
	</div>
{:else}
	{@render children()}
{/if}
