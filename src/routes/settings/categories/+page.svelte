<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';

	let { data, form } = $props();

	/**
	 * Every row posts to this page alongside the add bar, so a failure names the
	 * form it belongs to and only that one shows the message.
	 */
	const failed = $derived(form?.failed);
	const message = $derived(form?.error ?? '');
	const typed = $derived(form?.values ?? {});
</script>

<svelte:head>
	<title>Categories — Freyr</title>
</svelte:head>

<div class="page-head">
	<h1>Categories</h1>
	<span class="context">What the ledger files each transaction under</span>
</div>

<div class="panels">
	<section class="panel wide">
		<div class="panel-head">
			<h2>Categories</h2>
			<span class="meta">{data.categories.length}</span>
		</div>
		<div class="panel-body">
			<p class="prose">
				A category belongs to one bucket, or to one income source, and the entry bar offers only the
				ones matching what you picked there. Renaming carries every transaction with it. A category
				the ledger still points at is archived rather than deleted — it leaves the dropdown and
				keeps its history.
			</p>
		</div>

		<details class="entry-wrap" open>
			<summary>Add a category</summary>
			<form class="entry" method="POST" action="?/add" use:enhance>
				<div class="field">
					<label for="c-scope">Applies to</label>
					<select id="c-scope" name="scope">
						{#each data.scopes as scope (scope.value)}
							<option value={scope.value} selected={typed.scope === scope.value}>
								{scope.label}
							</option>
						{/each}
					</select>
				</div>
				<div class="field grow">
					<label for="c-name">Name</label>
					<input
						id="c-name"
						name="name"
						value={typed.name ?? ''}
						autocomplete="off"
						aria-describedby={failed === 'add' ? 'c-error' : undefined}
						required
					/>
				</div>
				<button class="primary" type="submit">Add category</button>
			</form>
			{#if failed === 'add'}<p class="error" id="c-error" role="alert">{message}</p>{/if}
		</details>

		<!-- Row edits have no control of their own to hang a message on. -->
		{#if failed && failed !== 'add'}<p class="error" role="alert">{message}</p>{/if}

		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Applies to</th>
						<th scope="col">Name</th>
						<th scope="col" class="num">Used</th>
						<th scope="col">Status</th>
						<th scope="col"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.categories as category (category.id)}
						<tr>
							<td data-label="Applies to"><span class="tag">{data.labels[category.scope]}</span></td
							>
							<td data-label="Name">
								<!--
								  The row is one form; the buttons in the last cell reach it by id
								  and pick their own action, so a rename, an archive and a delete
								  share the name field they all act on.
								-->
								<form id="cat-{category.id}" method="POST" action="?/rename" use:enhance>
									<input type="hidden" name="id" value={category.id} />
									<input
										class="row-input"
										name="name"
										value={category.name}
										aria-label="Name of {category.name}"
										autocomplete="off"
										required
									/>
								</form>
							</td>
							<td data-label="Used" class="num">{category.used}</td>
							<td data-label={category.archived ? 'Status' : null}>
								{#if category.archived}<span class="tag">archived</span>{/if}
							</td>
							<td data-label="" class="cell-actions">
								<button
									class="icon"
									type="submit"
									form="cat-{category.id}"
									aria-label="Save the name of {category.name}"
								>
									<Icon name="check" />
								</button>
								<button
									class="icon"
									type="submit"
									form="cat-{category.id}"
									formaction="?/archive"
									name="archived"
									value={category.archived ? '0' : '1'}
									aria-label={category.archived
										? `Restore ${category.name}`
										: `Archive ${category.name}`}
								>
									<Icon name={category.archived ? 'archive-restore' : 'archive'} />
								</button>
								<!-- Deleting is offered only where it cannot strip a label off history. -->
								{#if category.used === 0}
									<button
										class="icon"
										type="submit"
										form="cat-{category.id}"
										formaction="?/delete"
										aria-label="Delete {category.name}"
									>
										<Icon name="trash" />
									</button>
								{/if}
							</td>
						</tr>
					{:else}
						<tr><td class="empty" colspan="5">No categories yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
