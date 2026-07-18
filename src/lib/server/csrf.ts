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
	return !isSameHostOrigin(request.headers.get('origin'), request.headers.get('host'));
}
