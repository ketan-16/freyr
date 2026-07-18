import { createSession, createUser, userCount } from '$lib/server/auth';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (userCount(locals.db) > 0) error(404, 'Not found');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		if (userCount(locals.db) > 0) error(404, 'Not found');

		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (username.length < 2) return fail(400, { username, error: 'Username is too short.' });
		if (password.length < 8)
			return fail(400, { username, error: 'Password must be at least 8 characters.' });

		const id = createUser(locals.db, username, password);
		const token = createSession(locals.db, id);
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
