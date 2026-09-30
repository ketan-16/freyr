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
		<div class="auth-brand">
			<FreyrMark size={40} />
			<span class="wordmark">Freyr</span>
		</div>
		<div>
			<h1>Create your account</h1>
			<p>This runs once. Freyr keeps a single account, on this machine.</p>
		</div>
		<div class="field">
			<label for="username">Username</label>
			<input
				id="username"
				name="username"
				value={form?.username ?? ''}
				autocomplete="username"
				autocapitalize="none"
				required
			/>
		</div>
		<div class="field">
			<label for="password">Password <span class="muted">— at least 8 characters</span></label>
			<input
				id="password"
				name="password"
				type="password"
				minlength="8"
				autocomplete="new-password"
				required
			/>
		</div>
		<button class="btn primary block" type="submit">Create account</button>
		<!-- Feedback follows the action, and is announced: use:enhance never reloads. -->
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	</form>
</div>
