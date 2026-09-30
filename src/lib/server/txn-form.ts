/**
 * One place where posted form values become a transaction. Every add and every
 * edit — the ledger's entry bar, home, the add sheet — writes through here, so
 * their validation, trimming and category rules cannot drift apart.
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
	updateTransaction,
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

/**
 * Posted values → the fields a transaction takes from its form. Shared by
 * create and update, so an edit is held to exactly the rules an entry is.
 */
function inputFrom(db: DatabaseSync, values: Record<string, string>): TxnInput {
	const direction = values.direction as Direction;
	const bucket = direction === 'outflow' ? (values.bucket as Bucket) : undefined;
	const incomeSource = direction === 'income' ? (values.source as Source) : undefined;

	return {
		date: values.date,
		amountPaise: parseMoney(values.amount || ''),
		direction,
		bucket,
		incomeSource,
		note: values.note?.trim() || undefined,
		categoryId: categoryFor(db, bucket ?? incomeSource ?? null, values.category)
	};
}

/** Throws with a readable message on invalid input; callers turn that into a 400. */
export function createFromForm(db: DatabaseSync, values: Record<string, string>): number {
	return createTransaction(db, inputFrom(db, values));
}

/** The edit twin of `createFromForm`: the row is named by the posted `id`. */
export function updateFromForm(db: DatabaseSync, values: Record<string, string>): void {
	const id = Number(values.id);
	if (!values.id || !Number.isInteger(id) || id <= 0)
		throw new Error('That transaction no longer exists.');
	updateTransaction(db, id, inputFrom(db, values));
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

type Values = Record<string, string>;

/**
 * Runs one form write: a 400 failure carrying what was posted, or a redirect
 * to `back`. The create and update actions are this with their writer.
 */
async function txnAction(
	request: Request,
	back: string,
	write: (values: Values) => unknown
): Promise<ActionFailure<{ error: string; values: Values }>> {
	const form = await request.formData();
	const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) as Values;

	try {
		write(values);
	} catch (err) {
		return fail(400, { error: err instanceof Error ? err.message : String(err), values });
	}
	redirect(303, back);
}

/**
 * The shared create action. Returns a 400 failure carrying the submitted values, or
 * redirects to `back` on success. Both the home and ledger actions are one call to this.
 */
export function createTxnAction(
	request: Request,
	db: DatabaseSync,
	back: string
): Promise<ActionFailure<{ error: string; values: Values }>> {
	return txnAction(request, back, (values) => createFromForm(db, values));
}

/** The shared edit action: the same contract, for the row named by the posted `id`. */
export function updateTxnAction(
	request: Request,
	db: DatabaseSync,
	back: string
): Promise<ActionFailure<{ error: string; values: Values }>> {
	return txnAction(request, back, (values) => updateFromForm(db, values));
}
