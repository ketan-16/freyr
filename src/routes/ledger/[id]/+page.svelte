<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TxnForm from '$lib/components/TxnForm.svelte';
	import { dayLabel } from '$lib/dates';

	let { data, form } = $props();

	const year = $derived(Number(data.txn.date.slice(0, 4)));

	/** Posts carry the month the edit came from, so the redirect lands there. */
	const scope = $derived(data.back.split('?')[1] ?? '');
</script>

<svelte:head>
	<title>Edit transaction — Freyr</title>
</svelte:head>

<!--
  The edit surface without script, and for a row opened in a new tab. With
  script the ledger opens this same form in a sheet and never comes here.
-->
<PageHeader
	title="Edit transaction"
	sub="{dayLabel(data.txn.date, year)} {year}"
	back={{ href: data.back, label: 'Ledger' }}
/>

<div class="page">
	<section class="panel edit-panel">
		<TxnForm
			categories={data.entry.categories}
			txn={data.txn}
			action="?/update{scope ? `&${scope}` : ''}"
			deleteAction="?/delete{scope ? `&${scope}` : ''}"
			values={form?.values}
			error={form?.error}
			cancelHref={data.back}
		/>
	</section>
</div>
