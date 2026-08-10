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
		<div class="mark"><FreyrMark size={56} /></div>
		<h1>Welcome to Freyr</h1>
		<p>Create your account — this runs once.</p>
		<div class="field">
			<label for="username">Username</label>
			<input id="username" name="username" value={form?.username ?? ''} required />
		</div>
		<div class="field">
			<label for="password">Password (min 8 characters)</label>
			<input id="password" name="password" type="password" minlength="8" required />
		</div>
		<button class="primary" type="submit">Create account</button>
		<!--
		  Feedback follows the action: the message answers the submit, so it comes
		  after it. `role="alert"` because `use:enhance` never reloads — without it
		  a failed attempt is silent to a screen reader.
		-->
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	</form>
</div>
