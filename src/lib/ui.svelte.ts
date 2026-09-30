/**
 * The shell's client state: the add/edit sheet, the command menu and the
 * toasts. It holds UI only — never data; every figure still arrives through a
 * `load`. One instance per app mount, handed down through context rather than
 * a module singleton, so a server render can never share it between requests.
 */

import { getContext, setContext } from 'svelte';
import type { Txn } from '$lib/server/ledger';

/** A confirmation that something saved. Failures are never toasts: they stay beside the form. */
export interface Toast {
	id: number;
	text: string;
}

export class Ui {
	/** The add/edit sheet: open, and the row it edits (null when adding). */
	sheetOpen = $state(false);
	sheetTxn = $state<Txn | null>(null);
	menuOpen = $state(false);
	toasts = $state<Toast[]>([]);

	#seq = 0;

	add(): void {
		this.sheetTxn = null;
		this.sheetOpen = true;
	}

	edit(txn: Txn): void {
		this.sheetTxn = txn;
		this.sheetOpen = true;
	}

	toast(text: string): void {
		const id = ++this.#seq;
		this.toasts.push({ id, text });
		setTimeout(() => this.dismiss(id), 4000);
	}

	dismiss(id: number): void {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}
}

const KEY = Symbol('freyr-ui');

export function provideUi(): Ui {
	return setContext(KEY, new Ui());
}

export function useUi(): Ui {
	return getContext<Ui>(KEY);
}

/** A keystroke meant for the page, not for a field the user is typing in. */
export function isTyping(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.isContentEditable ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	);
}

/** A click that asks for a new tab or window: let the link do what it says. */
export function wantsNewTab(e: MouseEvent): boolean {
	return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}
