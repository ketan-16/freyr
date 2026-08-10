<script lang="ts">
	import { enhance } from '$app/forms';
	import FreyrMark from '$lib/components/FreyrMark.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Log in — Freyr</title>
</svelte:head>

<div class="auth">
	<form class="auth-card" method="POST" use:enhance>
		<div class="mark"><FreyrMark size={56} /></div>
		<h1>Freyr</h1>
		<p>Log in to continue.</p>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
		<div class="field">
			<label for="username">Username</label>
			<input id="username" name="username" value={form?.username ?? ''} required />
		</div>
		<div class="field">
			<label for="password">Password</label>
			<input id="password" name="password" type="password" required />
		</div>
		<button class="primary" type="submit">Log in</button>
	</form>
</div>
