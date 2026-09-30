<!--
  The add/edit sheet: TxnForm in a modal dialog, opened from anywhere — the
  sidebar, the phone's add tab, `N`, the command menu, a ledger row. A centred
  dialog on a desktop, a bottom sheet on a phone. The native <dialog> traps
  focus and closes on Escape; clicking the backdrop closes it too.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import type { Category } from '$lib/server/categories';
	import { useUi } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import TxnForm from './TxnForm.svelte';

	let { categories }: { categories: Category[] } = $props();

	const ui = useUi();
	let dialog = $state<HTMLDialogElement>();
	/** A post is in flight: closing now would drop its answer on the floor. */
	let busy = $state(false);
	/** Whether the press began on the backdrop — a text selection dragged out of a field does not. */
	let pressedBackdrop = false;
	/** The last add's answers: the next one starts from them. */
	let remembered = $state<Record<string, string>>({});

	$effect(() => {
		const d = dialog;
		if (!d) return;
		if (ui.sheetOpen && !d.open) {
			// A fresh sheet: the last save's in-flight flag must not carry over,
			// or its buttons open disabled and a phone has no way to close it.
			busy = false;
			d.showModal();
			tick().then(() => d.querySelector<HTMLInputElement>('[data-autofocus]')?.focus());
		} else if (!ui.sheetOpen && d.open) {
			d.close();
		}
	});

	function done(message: string, answers: Record<string, string>): void {
		if (!ui.sheetTxn && answers.direction) remembered = answers;
		ui.toast(message);
		ui.sheetOpen = false;
		busy = false;
	}
</script>

<!-- The dialog itself is only ever the target of a click on its backdrop. -->
<dialog
	bind:this={dialog}
	class="sheet"
	aria-labelledby="sheet-title"
	onclose={() => (ui.sheetOpen = false)}
	oncancel={(e) => {
		if (busy) e.preventDefault();
	}}
	onpointerdown={(e) => (pressedBackdrop = e.target === dialog)}
	onclick={(e) => {
		if (e.target === dialog && pressedBackdrop && !busy) ui.sheetOpen = false;
	}}
>
	{#if ui.sheetOpen}
		{@const txn = ui.sheetTxn}
		<div class="sheet-h">
			<h2 id="sheet-title">{txn ? 'Edit transaction' : 'New transaction'}</h2>
			<button
				class="icon-btn"
				type="button"
				aria-label="Close"
				title="Close  Esc"
				disabled={busy}
				onclick={() => (ui.sheetOpen = false)}
			>
				<Icon name="x" />
			</button>
		</div>
		<TxnForm
			{categories}
			{txn}
			{remembered}
			action={txn ? `/ledger/${txn.id}?/update` : '/ledger?/create'}
			deleteAction={txn ? `/ledger/${txn.id}?/delete` : undefined}
			onDone={done}
			onCancel={() => (ui.sheetOpen = false)}
			bind:busy
		/>
	{/if}
</dialog>
