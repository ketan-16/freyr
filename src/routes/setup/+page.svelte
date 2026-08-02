<script lang="ts">
	import { enhance } from '$app/forms';
	import FreyrMark from '$lib/components/FreyrMark.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Set up — Freyr</title>
</svelte:head>

<div class="auth">
	<form class="auth-card" method="POST" use:enhance>
		<div class="mark"><FreyrMark size={64} /></div>
		<h1>Welcome to Freyr</h1>
		<p>Create your account — this runs once.</p>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
		<div class="field">
			<label for="username">Username</label>
			<input id="username" name="username" value={form?.username ?? ''} required />
		</div>
		<div class="field">
			<label for="password">Password (min 8 characters)</label>
			<input id="password" name="password" type="password" minlength="8" required />
		</div>
		<button class="primary" type="submit">Create account</button>
	</form>
</div>
