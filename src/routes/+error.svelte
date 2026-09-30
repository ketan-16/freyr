<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
</script>

<svelte:head>
	<title>{page.status} — Freyr</title>
</svelte:head>

<PageHeader title={page.status === 404 ? 'Not found' : 'Something went wrong'} />

<div class="page">
	<div class="panel error-panel">
		<p class="big tnum">{page.status}</p>
		<p>{page.error?.message ?? 'An unexpected error occurred.'}</p>
		<a class="btn" href="/"><Icon name="house" />Back to Home</a>
	</div>
</div>
