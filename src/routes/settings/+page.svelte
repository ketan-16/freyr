<script lang="ts">
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { data } = $props();

	const sections: { href: string; icon: IconName; title: string; about: string }[] = [
		{
			href: '/settings/budget',
			icon: 'sliders-horizontal',
			title: 'Splits',
			about: 'The base split, the raise split, the promotion log and the periods they project'
		},
		{
			href: '/settings/categories',
			icon: 'tags',
			title: 'Categories',
			about: 'What each bucket and income source files transactions under'
		}
	];

	const shortcuts: [string[], string][] = [
		[['⌘', 'K'], 'Jump to a screen, a month or an action'],
		[['N'], 'New transaction'],
		[['G', 'H'], 'Home — and G L, G B, G Y, G S, G C for the rest'],
		[['[', ']'], 'Previous and next month or year'],
		[['/'], 'Filter the ledger'],
		[['←', '→'], 'Read the spending pace day by day, once it has focus'],
		[['Esc'], 'Close a sheet or the menu']
	];
</script>

<svelte:head>
	<title>Settings — Freyr</title>
</svelte:head>

<PageHeader title="Settings" />

<div class="page settings-page">
	<section class="panel" aria-labelledby="set-budget">
		<div class="panel-h"><h2 id="set-budget">Budget</h2></div>
		<div class="set-list">
			{#each sections as s (s.href)}
				<a class="set-item" href={s.href}>
					<span class="ico"><Icon name={s.icon} /></span>
					<span class="txt"><b>{s.title}</b><small>{s.about}</small></span>
					<Icon name="chevron-right" />
				</a>
			{/each}
		</div>
	</section>

	<section class="panel" aria-labelledby="set-look">
		<div class="panel-h"><h2 id="set-look">Appearance</h2></div>
		<div class="set-list">
			<div class="set-item">
				<span class="ico"><Icon name="monitor" /></span>
				<span class="txt">
					<b>Theme</b>
					<small>Follows the system until you choose; the choice is kept in a cookie.</small>
				</span>
				<ThemeToggle theme={data.theme} withLabel />
			</div>
		</div>
	</section>

	<section class="panel" aria-labelledby="set-account">
		<div class="panel-h"><h2 id="set-account">Account</h2></div>
		<div class="set-list">
			<div class="set-item">
				<span class="avatar" aria-hidden="true">{data.user?.username.slice(0, 1)}</span>
				<span class="txt"><b>{data.user?.username}</b><small>Signed in on this device</small></span>
				<form method="POST" action="/logout">
					<button class="btn" type="submit"><Icon name="log-out" />Log out</button>
				</form>
			</div>
		</div>
	</section>

	<section class="panel hide-phone" aria-labelledby="set-keys">
		<div class="panel-h"><h2 id="set-keys">Keyboard</h2></div>
		<div class="set-list">
			{#each shortcuts as [keys, what] (what)}
				<div class="set-item short">
					<span class="keys"
						>{#each keys as k (k)}<kbd>{k}</kbd>{/each}</span
					>
					<span class="txt">{what}</span>
				</div>
			{/each}
		</div>
	</section>
</div>
