import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		user: locals.user,
		// The toggle needs a concrete value to invert; the *rendering* of the
		// theme is handled by <html data-theme> in hooks.server.ts, not here.
		theme: locals.theme ?? 'light'
	};
};
