import { todayISO } from '$lib/dates';
import { parseMoney } from '$lib/money';
import { listGoals, listLocations } from '$lib/server/goals';
import {
	createTransaction,
	deleteTransaction,
	ensureCategory,
	listCategories,
	listTransactions,
	type Bucket,
	type Direction,
	type Source,
	type TxnInput
} from '$lib/server/ledger';
import { fail, redirect } from '@sveltejs/kit';
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
	return {
		filters,
		today: todayISO(),
		transactions: listTransactions(locals.db, filters),
		categories: listCategories(locals.db),
		goals: listGoals(locals.db).filter((g) => g.status === 'active'),
		locations: listLocations(locals.db)
	};
};

export const actions: Actions = {
	create: async ({ request, locals, url }) => {
		const form = await request.formData();
		const values = Object.fromEntries(
			[...form.entries()].map(([k, v]) => [k, String(v)])
		) as Record<string, string>;

		try {
			const direction = values.direction as Direction;
			const categoryName = values.category?.trim();
			const goalId = values.goal ? Number(values.goal) : undefined;
			const input: TxnInput = {
				date: values.date,
				amountPaise: parseMoney(values.amount || ''),
				direction,
				bucket: direction === 'outflow' ? (values.bucket as Bucket) : undefined,
				incomeSource: direction === 'income' ? (values.source as Source) : undefined,
				note: values.note?.trim() || undefined,
				categoryId:
					direction === 'outflow' && categoryName
						? ensureCategory(locals.db, categoryName)
						: undefined,
				goalId,
				locationId: values.location ? Number(values.location) : undefined
			};
			createTransaction(locals.db, input);
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : String(err), values });
		}
		redirect(303, backTo(url));
	},

	delete: async ({ request, locals, url }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (id) deleteTransaction(locals.db, id);
		redirect(303, backTo(url));
	}
};
