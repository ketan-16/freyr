<script lang="ts">
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children, data } = $props();

	const nav = [
		{ href: '/', label: 'Home' },
		{ href: '/ledger', label: 'Ledger' },
		{ href: '/monthly', label: 'Monthly' },
		{ href: '/yearly', label: 'Yearly' }
	];

	function current(href: string): 'page' | undefined {
		if (href === '/') return page.url.pathname === '/' ? 'page' : undefined;
		return page.url.pathname.startsWith(href) ? 'page' : undefined;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Freyr</title>
</svelte:head>

{#if data.user}
	<div class="frame">
		<nav class="sidebar">
			<p class="wordmark">FREYR</p>
			{#each nav as item (item.href)}
				<a href={item.href} aria-current={current(item.href)}>{item.label}</a>
			{/each}
			<p class="section">Settings</p>
			<a href="/settings/budget" aria-current={current('/settings/budget')}>Budget</a>
			<div class="spacer"></div>
			<form method="POST" action="/logout">
				<button class="link" type="submit">Log out ({data.user.username})</button>
			</form>
		</nav>
		<main>
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
