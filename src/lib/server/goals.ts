import type { DatabaseSync } from 'node:sqlite';
import type { Paise } from '$lib/money';

export interface GoalInput {
	name: string;
	kind: 'goal' | 'pot';
	targetPaise?: number | null;
	status?: 'active' | 'complete' | 'archived';
	plannedFor?: string | null;
}

export interface Goal {
	id: number;
	name: string;
	kind: 'goal' | 'pot';
	targetPaise: number | null;
	status: 'active' | 'complete' | 'archived';
	plannedFor: string | null;
}

export function createGoal(db: DatabaseSync, g: GoalInput): number {
	if (!g.name.trim()) throw new Error('Goal name is required.');
	if (g.targetPaise != null && (!Number.isInteger(g.targetPaise) || g.targetPaise <= 0))
		throw new Error('Goal target must be a positive amount.');
	const result = db
		.prepare(
			`INSERT INTO goals (name, kind, target_paise, status, planned_for)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.run(g.name.trim(), g.kind, g.targetPaise ?? null, g.status ?? 'active', g.plannedFor ?? null);
	return Number(result.lastInsertRowid);
}

export function listGoals(db: DatabaseSync): Goal[] {
	const rows = db
		.prepare('SELECT id, name, kind, target_paise, status, planned_for FROM goals ORDER BY name')
		.all() as Record<string, unknown>[];
	return rows.map(mapGoal);
}

function mapGoal(r: Record<string, unknown>): Goal {
	return {
		id: r.id as number,
		name: r.name as string,
		kind: r.kind as Goal['kind'],
		targetPaise: r.target_paise as number | null,
		status: r.status as Goal['status'],
		plannedFor: r.planned_for as string | null
	};
}

export function ensureLocation(db: DatabaseSync, name: string): number {
	db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)').run(name);
	const row = db.prepare('SELECT id FROM locations WHERE name = ?').get(name) as { id: number };
	return row.id;
}

export interface Location {
	id: number;
	name: string;
}

export function listLocations(db: DatabaseSync): Location[] {
	return db.prepare('SELECT id, name FROM locations ORDER BY name').all() as unknown as Location[];
}

export interface GoalProgress {
	goal: Goal;
	contributed: Paise;
}

/** Active goals with their total contributions — one grouped query, no N+1. */
export function goalProgress(db: DatabaseSync): GoalProgress[] {
	const rows = db
		.prepare(
			`SELECT g.id, g.name, g.kind, g.target_paise, g.status, g.planned_for,
			        COALESCE(SUM(t.amount_paise), 0) AS contributed
			 FROM goals g
			 LEFT JOIN transactions t ON t.goal_id = g.id
			 WHERE g.status = 'active'
			 GROUP BY g.id
			 ORDER BY g.name`
		)
		.all() as Record<string, unknown>[];
	return rows.map((r) => ({ goal: mapGoal(r), contributed: r.contributed as number }));
}
