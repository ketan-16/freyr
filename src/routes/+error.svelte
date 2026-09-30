<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
</script>

<svelte:head>
	<title>{page.status} — Freyr</title>
</svelte:head>

<!-- 503 is the service worker's: a page never saved on this device, offline. -->
<PageHeader
	title={page.status === 404
		? 'Not found'
		: page.status === 503
			? 'Offline'
			: 'Something went wrong'}
/>

<div class="page">
	<div class="panel error-panel">
		<!-- Offline is a state, not a fault: no status code to read. -->
		{#if page.status !== 503}<p class="big tnum">{page.status}</p>{/if}
		<p>{page.error?.message ?? 'An unexpected error occurred.'}</p>
		<a class="btn" href="/"><Icon name="house" />Back to Home</a>
	</div>
</div>
