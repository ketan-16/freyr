import { todayISO } from '$lib/dates';
import { deleteTransaction, getTransaction } from '$lib/server/ledger';
import { entryOptions, updateTxnAction } from '$lib/server/txn-form';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * The ledger month an edit returns to: the one it was opened from, carried in
 * the query exactly as /ledger carries its filters, else the month the row
 * itself falls in.
 */
function backTo(url: URL, date?: string): string {
	const q = new URLSearchParams();
	for (const key of ['year', 'month', 'bucket']) {
		const v = url.searchParams.get(key);
		if (v) q.set(key, v);
	}
	if (!q.has('year') && date) {
		q.set('year', String(Number(date.slice(0, 4))));
		q.set('month', String(Number(date.slice(5, 7))));
	}
	const qs = q.toString();
	return `/ledger${qs ? `?${qs}` : ''}`;
}

function idOf(raw: string): number {
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : 0;
}

/**
 * One transaction and the categories its form offers. This page is the edit
 * surface without JavaScript and for a link opened in a new tab; with it, the
 * ledger opens the same form in a sheet and posts here.
 */
export const load: PageServerLoad = ({ locals, params, url }) => {
	const txn = getTransaction(locals.db, idOf(params.id));
	if (!txn) error(404, 'That transaction no longer exists.');
	return { txn, back: backTo(url, txn.date), entry: entryOptions(locals.db, todayISO()) };
};

export const actions: Actions = {
	update: ({ request, locals, url }) => updateTxnAction(request, locals.db, backTo(url)),

	delete: async ({ locals, params, url }) => {
		const id = idOf(params.id);
		const txn = id ? getTransaction(locals.db, id) : null;
		if (txn) deleteTransaction(locals.db, id);
		redirect(303, backTo(url, txn?.date));
	}
};
