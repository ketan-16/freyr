<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let { data, form } = $props();

	/**
	 * Every row posts here alongside the add forms, so a failure names the form
	 * it belongs to — and, for an add, the scope it was for — and only that one
	 * shows the message.
	 */
	const failed = $derived(form?.failed);
	const message = $derived(form?.error ?? '');
	const typed = $derived<Record<string, string>>(form?.values ?? {});

	/**
	 * One column per bucket or income source, in the order the entry form offers
	 * them. A scope that can no longer be picked (`other`, from imports) still
	 * gets a column when something is filed under it, or those rows would vanish.
	 */
	const groups = $derived.by(() => {
		const offered = data.scopes.map((s) => s.value as string);
		const held = [...new Set(data.categories.map((c) => c.scope))].filter(
			(scope) => !offered.includes(scope)
		);
		return [
			...data.scopes.map((s) => ({ ...s, pickable: true })),
			...held.map((value) => ({ value, label: data.labels[value], pickable: false }))
		].map((scope) => {
			const categories = data.categories.filter((c) => c.scope === scope.value);
			return {
				...scope,
				categories,
				live: categories.filter((c) => !c.archived).length,
				used: categories.reduce((t, c) => t + c.used, 0)
			};
		});
	});
</script>

<svelte:head>
	<title>Categories — Freyr</title>
</svelte:head>

<PageHeader
	title="Categories"
	sub="What each transaction is filed under"
	back={{ href: '/settings', label: 'Settings' }}
/>

<div class="page">
	<p class="lede">
		A category belongs to one bucket or one income source, and the add form offers only the ones
		matching what you picked. Renaming carries every transaction with it. One the ledger still
		points at is archived rather than deleted — it leaves the form and keeps its history.
	</p>

	<!-- Row edits have no control of their own to hang a message on. -->
	{#if failed && failed !== 'add'}<p class="error" role="alert">{message}</p>{/if}

	<div class="scope-cols">
		{#each groups as group (group.value)}
			<section class="panel" aria-labelledby="scope-{group.value}">
				<div class="panel-h">
					<h2
						id="scope-{group.value}"
						class="bk {group.value === 'investments' ? 'invest' : group.value}"
					>
						{group.label}
					</h2>
					<span class="meta">{group.live} · {group.used} used</span>
				</div>
				{#if group.pickable}
					<form class="cat-add" method="POST" action="?/add" use:enhance>
						<input type="hidden" name="scope" value={group.value} />
						<label class="visually-hidden" for="add-{group.value}">New {group.label} category</label
						>
						<input
							id="add-{group.value}"
							name="name"
							value={failed === 'add' && typed.scope === group.value ? (typed.name ?? '') : ''}
							placeholder="Add {/^[aeiou]/i.test(group.label)
								? 'an'
								: 'a'} {group.label.toLowerCase()} category"
							autocomplete="off"
							aria-describedby={failed === 'add' && typed.scope === group.value
								? `err-${group.value}`
								: undefined}
							required
						/>
						<button class="btn" type="submit" aria-label="Add to {group.label}">
							<Icon name="plus" />
						</button>
					</form>
					{#if failed === 'add' && typed.scope === group.value}
						<p class="error panel-note" id="err-{group.value}" role="alert">{message}</p>
					{/if}
				{/if}
				<div class="cat-list">
					{#each group.categories as c (c.id)}
						<div class="cat-row" class:archived={c.archived}>
							<!--
							  The row is one form; the buttons reach it by id and pick their own
							  action, so rename, archive and delete share the name field.
							-->
							<form class="rename" id="cat-{c.id}" method="POST" action="?/rename" use:enhance>
								<input type="hidden" name="id" value={c.id} />
								<input
									class="row-input"
									name="name"
									value={c.name}
									aria-label="Name of {c.name}"
									autocomplete="off"
									required
								/>
							</form>
							{#if c.archived}<span class="tag">archived</span>{/if}
							<span class="used" title="Transactions filed under it">{c.used}</span>
							<button
								class="icon-btn save"
								type="submit"
								form="cat-{c.id}"
								aria-label="Save the name of {c.name}"
								title="Save name"
							>
								<Icon name="check" size={15} />
							</button>
							<button
								class="icon-btn"
								type="submit"
								form="cat-{c.id}"
								formaction="?/archive"
								name="archived"
								value={c.archived ? '0' : '1'}
								aria-label={c.archived ? `Restore ${c.name}` : `Archive ${c.name}`}
								title={c.archived ? 'Restore' : 'Archive'}
							>
								<Icon name={c.archived ? 'archive-restore' : 'archive'} size={15} />
							</button>
							<!-- Delete only where it cannot strip a label off history. -->
							{#if c.used === 0}
								<button
									class="icon-btn danger"
									type="submit"
									form="cat-{c.id}"
									formaction="?/delete"
									aria-label="Delete {c.name}"
									title="Delete"
								>
									<Icon name="trash" size={15} />
								</button>
							{:else}
								<span class="icon-slot" aria-hidden="true"></span>
							{/if}
						</div>
					{:else}
						<p class="empty-note">None yet.</p>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>
