import { listCategories } from '$lib/server/categories';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		user: locals.user,
		// The toggle needs a concrete value to invert; the *rendering* of the
		// theme is handled by <html data-theme> in hooks.server.ts, not here.
		theme: locals.theme ?? 'light',
		// Whether that theme was chosen, or is a guess while the OS decides.
		themeChosen: locals.theme != null,
		// The add sheet opens from every screen, so the categories it offers ride
		// with the layout: one short read, rerun only when a form action
		// invalidates the page — which is exactly when a category can change.
		entryCategories: locals.user ? listCategories(locals.db) : []
	};
};
