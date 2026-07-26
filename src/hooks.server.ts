import { SESSION_COOKIE_NAME, SESSION_TOUCH_INTERVAL_MS } from '$lib/server/auth/config';
import type { AuthenticatedSession } from '$lib/server/auth/types';
import { AuthRepository } from '$lib/server/db';
import { hashToken } from '$lib/server/security/tokens';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = null;
	const token = event.cookies.get(SESSION_COOKIE_NAME);
	const env = event.platform?.env;

	if (!token || !env?.DB) {
		return resolve(event);
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
		return resolve(event);
	}

	const session: AuthenticatedSession = {
		sessionHash: row.session_hash,
		email: row.email,
		memberId: row.member_id,
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

	return resolve(event);
};
