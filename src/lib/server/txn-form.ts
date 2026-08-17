/**
 * One place where posted form values become a transaction. Both the ledger and
 * the home command centre write through here, so their validation, trimming and
 * category rules cannot drift apart.
 */

import type { DatabaseSync } from 'node:sqlite';
import { parseMoney } from '$lib/money';
import { fail, redirect, type ActionFailure } from '@sveltejs/kit';
import {
	getCategory,
	listCategories,
	SCOPE_LABELS,
	type Category,
	type CategoryScope
} from './categories';
import {
	createTransaction,
	type Bucket,
	type Direction,
	type Source,
	type TxnInput
} from './ledger';

/**
 * The posted category, checked against the scope it has to belong to — the
 * bucket for an outflow, the source for income. That check is this app's only
 * cross-table invariant, so it has no CHECK behind it and lives here instead;
 * nothing else in the app writes category_id.
 *
 * A null scope means the form named neither a bucket nor a source. That is
 * createTransaction's error to report, in its own words, so this says nothing.
 */
function categoryFor(
	db: DatabaseSync,
	scope: CategoryScope | null,
	posted: string | undefined
): number | undefined {
	if (!scope) return undefined;

	const id = Number(posted);
	if (!posted || !Number.isInteger(id) || id <= 0) throw new Error('Pick a category.');

	const category = getCategory(db, id);
	if (!category) throw new Error('That category no longer exists.');
	if (category.scope !== scope)
		throw new Error(`"${category.name}" is not a ${SCOPE_LABELS[scope].toLowerCase()} category.`);
	return id;
}

/** Throws with a readable message on invalid input; callers turn that into a 400. */
export function createFromForm(db: DatabaseSync, values: Record<string, string>): number {
	const direction = values.direction as Direction;
	const bucket = direction === 'outflow' ? (values.bucket as Bucket) : undefined;
	const incomeSource = direction === 'income' ? (values.source as Source) : undefined;

	const input: TxnInput = {
		date: values.date,
		amountPaise: parseMoney(values.amount || ''),
		direction,
		bucket,
		incomeSource,
		note: values.note?.trim() || undefined,
		categoryId: categoryFor(db, bucket ?? incomeSource ?? null, values.category)
	};

	return createTransaction(db, input);
}

/** Everything EntryBar needs. One source, so adding a field cannot miss a page. */
export function entryOptions(
	db: DatabaseSync,
	today: string
): {
	today: string;
	categories: Category[];
} {
	// The whole list, every scope, in one read: the bar filters it to the
	// selected bucket or source in the browser, so switching bucket costs no
	// round trip and the page carries a few dozen rows to pay for it.
	return { today, categories: listCategories(db) };
}

/**
 * The shared create action. Returns a 400 failure carrying the submitted values, or
 * redirects to `back` on success. Both the home and ledger actions are one call to this.
 */
export async function createTxnAction(
	request: Request,
	db: DatabaseSync,
	back: string
): Promise<ActionFailure<{ error: string; values: Record<string, string> }>> {
	const form = await request.formData();
	const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) as Record<
		string,
		string
	>;

	try {
		createFromForm(db, values);
	} catch (err) {
		return fail(400, { error: err instanceof Error ? err.message : String(err), values });
	}
	redirect(303, back);
}
