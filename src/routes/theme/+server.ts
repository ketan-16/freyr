import { redirect, type RequestHandler } from '@sveltejs/kit';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Persist the theme choice and return the user to where they were. */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const form = await request.formData();
	const to = form.get('to') === 'dark' ? 'dark' : 'light';

	cookies.set('freyr_theme', to, {
		path: '/',
		maxAge: ONE_YEAR,
		sameSite: 'lax'
	});

	// Only ever bounce back to our own paths — never an absolute or //host URL.
	const back = String(form.get('back') ?? '/');
	const safe = back.startsWith('/') && !back.startsWith('//') ? back : '/';
	redirect(303, safe);
};
