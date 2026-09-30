/**
 * The shell's client state: the add/edit sheet, the command menu, the toasts
 * and the theme. It holds UI only — never data; every figure still arrives through a
 * `load`. One instance per app mount, handed down through context rather than
 * a module singleton, so a server render can never share it between requests.
 */

import { getContext, setContext } from 'svelte';
import type { Txn } from '$lib/server/ledger';
import type { ThemeChoice } from '$lib/theme';

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
	/**
	 * The theme setting. Seeded from the cookie the server read; after that
	 * this device's choice is the authority, so it changes the moment it is
	 * made rather than after a round trip.
	 */
	theme = $state<ThemeChoice>('system');

	#seq = 0;

	constructor(theme: ThemeChoice) {
		this.theme = theme;
	}

	/** Apply a theme now, and keep it for the next page the server renders. */
	setTheme(choice: ThemeChoice): void {
		this.theme = choice;
		const root = document.documentElement;
		if (choice === 'system') delete root.dataset.theme;
		else root.dataset.theme = choice;
		// The cookie is only the server's copy. `manual` leaves the endpoint's
		// redirect (there for script-off posts) unfollowed; offline, the service
		// worker holds the post until the connection is back.
		fetch('/theme', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: `to=${choice}`,
			redirect: 'manual'
		}).catch(() => {});
	}

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

export function provideUi(theme: ThemeChoice): Ui {
	return setContext(KEY, new Ui(theme));
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

/**
 * Pin a popover beside the button that opens it, kept inside the viewport.
 * Popovers live in the top layer, which is viewport-fixed, so the button's
 * own rect is the coordinate space. `width` is the popover's CSS width: it is
 * placed before it renders, so it cannot be measured yet.
 */
export function anchorPopover(
	pop: HTMLElement,
	button: HTMLElement,
	{
		width,
		side,
		align = 'center'
	}: { width: number; side: 'below' | 'above'; align?: 'center' | 'start' }
): void {
	const r = button.getBoundingClientRect();
	const want = align === 'start' ? r.left : r.left + r.width / 2 - width / 2;
	pop.style.inset = 'auto';
	pop.style.margin = '0';
	pop.style.left = `${Math.min(Math.max(8, want), innerWidth - width - 8)}px`;
	if (side === 'below') pop.style.top = `${r.bottom + 6}px`;
	else pop.style.bottom = `${innerHeight - r.top + 6}px`;
}
