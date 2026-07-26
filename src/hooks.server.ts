import { SESSION_COOKIE_NAME, SESSION_TOUCH_INTERVAL_MS } from '$lib/server/auth/config';
import type { AuthenticatedSession } from '$lib/server/auth/types';
import { AuthRepository } from '$lib/server/db';
import { hashToken } from '$lib/server/security/tokens';
import type { Handle, HandleServerError } from '@sveltejs/kit';

const SECURITY_HEADERS = {
	'referrer-policy': 'strict-origin-when-cross-origin',
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'permissions-policy': 'camera=(), microphone=(), geolocation=()'
} as const;

export function applyResponseHeaders(response: Response, requestId: string): Response {
	response.headers.set('x-request-id', requestId);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(name, value);
	}
	return response;
}

export const handle: Handle = async ({ event, resolve }) => {
	const requestId = crypto.randomUUID();
	event.locals.requestId = requestId;
	event.locals.session = null;
	const token = event.cookies.get(SESSION_COOKIE_NAME);
	const env = event.platform?.env;

	if (!token || !env?.DB) {
		return applyResponseHeaders(await resolve(event), requestId);
	}

	const sessionHash = await hashToken(token);
	const repository = new AuthRepository(env.DB);
	const now = new Date();
	const row = await repository.findValidSession(sessionHash, now.toISOString());

	if (!row) {
		event.cookies.delete(SESSION_COOKIE_NAME, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax'
		});
		return applyResponseHeaders(await resolve(event), requestId);
	}

	const session: AuthenticatedSession = {
		sessionHash: row.session_hash,
		email: row.email,
		memberId: row.member_id,
		viewedMemberId: row.viewed_member_id,
		expiresAt: row.expires_at,
		lastSeenAt: row.last_seen_at
	};
	event.locals.session = session;

	const lastSeen = new Date(
		row.last_seen_at.includes('T') ? row.last_seen_at : `${row.last_seen_at.replace(' ', 'T')}Z`
	);
	if (
		Number.isNaN(lastSeen.getTime()) ||
		now.getTime() - lastSeen.getTime() >= SESSION_TOUCH_INTERVAL_MS
	) {
		const touch = repository.touchSession(sessionHash, now.toISOString());
		if (event.platform?.ctx) {
			event.platform.ctx.waitUntil(touch);
		} else {
			await touch;
		}
	}

	return applyResponseHeaders(await resolve(event), requestId);
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const requestId = event.locals.requestId || crypto.randomUUID();
	console.error(
		JSON.stringify({
			event: 'request_failed',
			requestId,
			method: event.request.method,
			path: event.url.pathname,
			status,
			message: error instanceof Error ? error.message : message
		})
	);
	return {
		message: status >= 500 ? 'Something went wrong. Please try again.' : message,
		requestId
	};
};
