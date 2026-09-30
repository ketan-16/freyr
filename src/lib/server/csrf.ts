/**
 * Freyr serves plain HTTP on several addresses at once (localhost + LAN IP +
 * Tailscale), so SvelteKit's built-in origin check — which needs one absolute
 * ORIGIN and assumes https with adapter-node — rejects legitimate posts. We
 * disable it (vite.config.ts) and enforce a protocol-agnostic same-host check
 * here instead: the Origin header's host must equal the Host header.
 */
export function isSameHostOrigin(origin: string | null, host: string | null): boolean {
	if (!origin || !host) return false;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** True when the request needs (and fails) the same-host origin check. */
export function isCrossSiteWrite(request: Request): boolean {
	if (SAFE_METHODS.has(request.method)) return false;
	const origin = request.headers.get('origin');
	// A cross-site attacker's browser always attaches an Origin header that
	// names a real, foreign host, so a write is forbidden only when one is
	// present and its host differs from ours. Two non-attack cases carry no
	// usable origin and must be allowed, or a plain (non-JS) same-origin form
	// POST 403s: Safari sends no Origin at all on a same-origin form navigation,
	// and serialises it as the literal "null" when the page suppresses the
	// referrer (Referrer-Policy: no-referrer, which we set). SameSite=Lax already
	// stops a cross-site POST from carrying the session cookie, so both are safe.
	if (origin === null || origin === 'null') return false;
	return !isSameHostOrigin(origin, request.headers.get('host'));
}
