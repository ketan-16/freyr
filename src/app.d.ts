import type { DatabaseSync } from 'node:sqlite';
import type { SessionUser } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			db: DatabaseSync;
			user: SessionUser | null;
			/** null means "no cookie set — follow prefers-color-scheme". */
			theme: 'light' | 'dark' | null;
		}
	}
}

export {};
