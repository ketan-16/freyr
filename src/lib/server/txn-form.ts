/**
 * One place where posted form values become a transaction. Both the ledger and
 * the home command centre write through here, so their validation, trimming and
 * category-creation behaviour cannot drift apart.
 */

import type { DatabaseSync } from 'node:sqlite';
import { parseMoney } from '$lib/money';
import { fail, redirect, type ActionFailure } from '@sveltejs/kit';
import { listGoals, listLocations } from './goals';
import {
	createTransaction,
	ensureCategory,
	listCategories,
	type Bucket,
	type Category,
	type Direction,
	type Source,
	type TxnInput
} from './ledger';

/** Throws with a readable message on invalid input; callers turn that into a 400. */
export function createFromForm(db: DatabaseSync, values: Record<string, string>): number {
	const direction = values.direction as Direction;
	const categoryName = values.category?.trim();

	const input: TxnInput = {
		date: values.date,
		amountPaise: parseMoney(values.amount || ''),
		direction,
		bucket: direction === 'outflow' ? (values.bucket as Bucket) : undefined,
		incomeSource: direction === 'income' ? (values.source as Source) : undefined,
		note: values.note?.trim() || undefined,
		categoryId:
			direction === 'outflow' && categoryName ? ensureCategory(db, categoryName) : undefined,
		goalId: values.goal ? Number(values.goal) : undefined,
		locationId: values.location ? Number(values.location) : undefined
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
	goals: { id: number; name: string }[];
	locations: { id: number; name: string }[];
} {
	return {
		today,
		categories: listCategories(db),
		goals: listGoals(db).filter((g) => g.status === 'active'),
		locations: listLocations(db)
	};
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
