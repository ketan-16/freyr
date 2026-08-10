import { todayISO } from '$lib/dates';
import { deleteTransaction, listTransactions, type Bucket } from '$lib/server/ledger';
import { createTxnAction, entryOptions } from '$lib/server/txn-form';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function filtersFrom(url: URL): { year: number; month: number; bucket?: Bucket } {
	const today = todayISO();
	const year = Number(url.searchParams.get('year')) || Number(today.slice(0, 4));
	const month = Number(url.searchParams.get('month')) || Number(today.slice(5, 7));
	const bucket = url.searchParams.get('bucket') as Bucket | null;
	return bucket ? { year, month, bucket } : { year, month };
}

function backTo(url: URL): string {
	const q = new URLSearchParams();
	for (const key of ['year', 'month', 'bucket']) {
		const v = url.searchParams.get(key);
		if (v) q.set(key, v);
	}
	const qs = q.toString();
	return `/ledger${qs ? `?${qs}` : ''}`;
}

export const load: PageServerLoad = ({ locals, url }) => {
	const filters = filtersFrom(url);
	const today = todayISO();
	return {
		filters,
		today,
		transactions: listTransactions(locals.db, filters),
		// Grouped under `entry` so the shape matches what <EntryBar> takes on
		// home; the top-level `today` still feeds the year picker.
		entry: entryOptions(locals.db, today)
	};
};

export const actions: Actions = {
	create: ({ request, locals, url }) => createTxnAction(request, locals.db, backTo(url)),

	delete: async ({ request, locals, url }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) deleteTransaction(locals.db, id);
		redirect(303, backTo(url));
	}
};
