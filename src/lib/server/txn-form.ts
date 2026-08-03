/**
 * One place where posted form values become a transaction. Both the ledger and
 * the home command centre write through here, so their validation, trimming and
 * category-creation behaviour cannot drift apart.
 */

import type { DatabaseSync } from 'node:sqlite';
import { parseMoney } from '$lib/money';
import {
	createTransaction,
	ensureCategory,
	type Bucket,
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
