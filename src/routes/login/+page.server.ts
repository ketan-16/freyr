import { createSession, verifyLogin } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');

		const userId = verifyLogin(locals.db, username, password);
		if (userId === null) return fail(401, { username, error: 'Wrong username or password.' });

		const token = createSession(locals.db, userId);
		cookies.set('freyr_session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 90 * 24 * 60 * 60
		});
		redirect(303, '/');
	}
};
