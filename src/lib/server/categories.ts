/**
 * Categories, scoped to the bucket or income source they belong to. The entry
 * form asks for a direction, then a bucket (outflow) or a source (income), and
 * offers only the categories scoped to that answer — so the list stays short
 * however many are configured.
 *
 * That a transaction's category matches its own bucket or source is the one
 * invariant SQLite cannot hold: it spans two tables, so no CHECK can see it.
 * `txn-form` enforces it on the way in; nothing else writes category_id.
 */

import type { DatabaseSync } from 'node:sqlite';
import { SQLITE_CONSTRAINT_UNIQUE } from './db';
import { BUCKETS, SOURCES, type Bucket, type Source } from './ledger';

/** A bucket (what an outflow can be) or an income source (what income can be). */
export type CategoryScope = Bucket | Source;

export const CATEGORY_SCOPES: CategoryScope[] = [...BUCKETS, ...SOURCES];

/**
 * The scopes settings offers. 'other' is missing on purpose: the entry bar
 * never books income as 'other' (no rollup counts it), so a category there
 * could never be picked. It stays a legal scope for imported rows.
 */
export const SELECTABLE_SCOPES: CategoryScope[] = CATEGORY_SCOPES.filter((s) => s !== 'other');

export const SCOPE_LABELS: Record<CategoryScope, string> = {
	needs: 'Needs',
	wants: 'Wants',
	investments: 'Investments',
	job: 'Job',
	side_hustle: 'Side hustle',
	other: 'Other'
};

export interface Category {
	id: number;
	scope: CategoryScope;
	name: string;
	archived: boolean;
}

export interface CategoryUsage extends Category {
	/** Transactions pointing at this category. Zero means it is safe to delete. */
	used: number;
}

/**
 * Scopes sort the way the UI lists them — the three buckets, then the income
 * sources — not alphabetically, which would put investments before needs.
 */
const SCOPE_ORDER_SQL = `CASE scope ${CATEGORY_SCOPES.map((s, i) => `WHEN '${s}' THEN ${i}`).join(' ')} END`;

const SELECT_SQL = 'SELECT id, scope, name, archived FROM categories';

function mapCategory(r: Record<string, unknown>): Category {
	return {
		id: r.id as number,
		scope: r.scope as CategoryScope,
		name: r.name as string,
		archived: r.archived === 1
	};
}

/** Validated, trimmed name; the CHECK backs this up but says it far less well. */
function cleanName(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Category name is required.');
	return trimmed;
}

function assertScope(scope: CategoryScope): void {
	if (!CATEGORY_SCOPES.includes(scope)) throw new Error(`Unknown category scope: ${scope}.`);
}

/**
 * Turns the one constraint an ordinary edit can hit — UNIQUE (scope, name) —
 * into a sentence, with the raw constraint text demoted to the cause.
 */
function withUniqueMessage<T>(scope: CategoryScope, name: string, write: () => T): T {
	try {
		return write();
	} catch (err) {
		if ((err as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE)
			throw new Error(
				`A ${SCOPE_LABELS[scope].toLowerCase()} category called "${name}" already exists.`,
				{
					cause: err
				}
			);
		throw err;
	}
}

/** The categories the entry form offers: active only, ordered for display. */
export function listCategories(db: DatabaseSync): Category[] {
	const rows = db
		.prepare(`${SELECT_SQL} WHERE archived = 0 ORDER BY ${SCOPE_ORDER_SQL}, name`)
		.all() as Record<string, unknown>[];
	return rows.map(mapCategory);
}

/**
 * Every category, archived included, with how many transactions use it — the
 * settings table. One grouped join over the partial index on category_id, so
 * it costs the categories, not the ledger.
 */
export function listCategoryUsage(db: DatabaseSync): CategoryUsage[] {
	const rows = db
		.prepare(
			`SELECT c.id, c.scope, c.name, c.archived, COUNT(t.id) AS used
			 FROM categories c
			 LEFT JOIN transactions t ON t.category_id = c.id
			 GROUP BY c.id
			 ORDER BY ${SCOPE_ORDER_SQL}, c.name`
		)
		.all() as Record<string, unknown>[];
	return rows.map((r) => ({ ...mapCategory(r), used: r.used as number }));
}

export function getCategory(db: DatabaseSync, id: number): Category | null {
	const row = db.prepare(`${SELECT_SQL} WHERE id = ?`).get(id) as
		Record<string, unknown> | undefined;
	return row ? mapCategory(row) : null;
}

export function createCategory(
	db: DatabaseSync,
	c: { scope: CategoryScope; name: string }
): number {
	assertScope(c.scope);
	const name = cleanName(c.name);
	return withUniqueMessage(c.scope, name, () =>
		Number(
			db.prepare('INSERT INTO categories (scope, name) VALUES (?, ?)').run(c.scope, name)
				.lastInsertRowid
		)
	);
}

/** Renaming is by id, so every transaction already on the category follows. */
export function renameCategory(db: DatabaseSync, id: number, name: string): void {
	const existing = required(db, id);
	const clean = cleanName(name);
	withUniqueMessage(existing.scope, clean, () =>
		db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(clean, id)
	);
}

export function setCategoryArchived(db: DatabaseSync, id: number, archived: boolean): void {
	required(db, id);
	db.prepare('UPDATE categories SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id);
}

/**
 * Only ever removes a category nothing points at. category_id is ON DELETE SET
 * NULL, so deleting a used one would quietly strip the label off history —
 * archiving is the answer there, and the message says so.
 */
export function deleteCategory(db: DatabaseSync, id: number): void {
	const category = required(db, id);
	const { used } = db
		.prepare('SELECT COUNT(*) AS used FROM transactions WHERE category_id = ?')
		.get(id) as { used: number };
	if (used > 0)
		throw new Error(
			`"${category.name}" is used by ${used} transaction${used === 1 ? '' : 's'} — archive it instead.`
		);
	db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

/** Get-or-create by (scope, name). The importer's way in; the UI creates explicitly. */
export function ensureCategory(db: DatabaseSync, scope: CategoryScope, name: string): number {
	assertScope(scope);
	const clean = cleanName(name);
	db.prepare('INSERT OR IGNORE INTO categories (scope, name) VALUES (?, ?)').run(scope, clean);
	const row = db
		.prepare('SELECT id FROM categories WHERE scope = ? AND name = ?')
		.get(scope, clean) as {
		id: number;
	};
	return row.id;
}

function required(db: DatabaseSync, id: number): Category {
	const category = getCategory(db, id);
	if (!category) throw new Error('That category no longer exists.');
	return category;
}
