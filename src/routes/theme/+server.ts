import { redirect, type RequestHandler } from '@sveltejs/kit';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Persist the theme choice and return the user to where they were. */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const form = await request.formData();
	const to = form.get('to') === 'dark' ? 'dark' : 'light';

	// `secure: false` for the same reason the session cookie sets it: Freyr does
	// not terminate TLS and is reached over a plain-HTTP LAN or Tailscale
	// address (STACK.md § Serving). SvelteKit defaults `secure` to true off
	// localhost, and a browser silently drops a Secure cookie on http://, so the
	// toggle appeared to do nothing on every device except the box itself.
	cookies.set('freyr_theme', to, {
		path: '/',
		maxAge: ONE_YEAR,
		sameSite: 'lax',
		secure: false
	});

	// Only ever bounce back to our own paths — never an absolute or //host URL.
	const back = String(form.get('back') ?? '/');
	const safe = back.startsWith('/') && !back.startsWith('//') ? back : '/';
	redirect(303, safe);
};
