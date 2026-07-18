import { destroySession } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		const token = cookies.get('freyr_session');
		if (token) destroySession(locals.db, token);
		cookies.delete('freyr_session', { path: '/' });
		redirect(303, '/login');
	}
};
