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
		<div class="auth-brand">
			<FreyrMark size={40} />
			<span class="wordmark">Freyr</span>
		</div>
		<div>
			<h1>Log in</h1>
			<p>Your ledger, on your own machine.</p>
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
			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>
		<button class="btn primary block" type="submit">Log in</button>
		<!--
		  Feedback follows the action, so the message comes after the submit.
		  `role="alert"` because use:enhance never reloads the page.
		-->
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	</form>
</div>
