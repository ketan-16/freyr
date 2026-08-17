import {
	createCategory,
	deleteCategory,
	listCategoryUsage,
	renameCategory,
	setCategoryArchived,
	SCOPE_LABELS,
	SELECTABLE_SCOPES,
	type CategoryScope
} from '$lib/server/categories';
import { fail, redirect, type ActionFailure } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * One read: every category with its transaction count, grouped over the partial
 * index on category_id. It costs the categories, not the ledger, so the page
 * stays flat as the ledger grows.
 */
export const load: PageServerLoad = ({ locals }) => ({
	categories: listCategoryUsage(locals.db),
	scopes: SELECTABLE_SCOPES.map((value) => ({ value, label: SCOPE_LABELS[value] })),
	labels: SCOPE_LABELS
});

/** Which form a failure belongs to — every row posts here, and only one may show it. */
type FormName = 'add' | 'rename' | 'archive' | 'delete';

type Values = Record<string, string>;

async function values(request: Request): Promise<Values> {
	const form = await request.formData();
	return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

/**
 * Runs one domain write, turning whatever it throws into a 400 on the named
 * form. Every rule — the blank name, the duplicate inside a scope, deleting a
 * category history still points at — lives in the domain and arrives already
 * phrased, so nothing here restates it.
 */
function attempt(
	name: FormName,
	v: Values,
	write: () => void
): ActionFailure<{ failed: FormName; error: string; values: Values }> {
	try {
		write();
	} catch (err) {
		return fail(400, {
			failed: name,
			error: err instanceof Error ? err.message : String(err),
			values: v
		});
	}
	redirect(303, '/settings/categories');
}

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const v = await values(request);
		return attempt('add', v, () =>
			createCategory(locals.db, { scope: v.scope as CategoryScope, name: v.name ?? '' })
		);
	},

	// By id, so every transaction already filed under it follows the new name.
	rename: async ({ request, locals }) => {
		const v = await values(request);
		return attempt('rename', v, () => renameCategory(locals.db, Number(v.id), v.name ?? ''));
	},

	// The archived flag rides on the submitter button, so one action covers
	// hiding a category and putting it back.
	archive: async ({ request, locals }) => {
		const v = await values(request);
		return attempt('archive', v, () =>
			setCategoryArchived(locals.db, Number(v.id), v.archived === '1')
		);
	},

	delete: async ({ request, locals }) => {
		const v = await values(request);
		return attempt('delete', v, () => deleteCategory(locals.db, Number(v.id)));
	}
};
