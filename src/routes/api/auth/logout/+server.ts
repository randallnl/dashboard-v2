import { clearSessionCookie } from '$lib/server/auth/cookies';
import { SESSION_COOKIE_NAME } from '$lib/server/auth/config';
import { AuthRepository } from '$lib/server/db';
import { hashToken } from '$lib/server/security/tokens';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

async function logout(
	cookies: Parameters<RequestHandler>[0]['cookies'],
	platform: Parameters<RequestHandler>[0]['platform']
): Promise<never> {
	const token = cookies.get(SESSION_COOKIE_NAME);
	if (token && platform?.env.DB) {
		await new AuthRepository(platform.env.DB).deleteSession(await hashToken(token));
	}

	clearSessionCookie(cookies);
	redirect(303, '/');
}

export const GET: RequestHandler = ({ cookies, platform }) => logout(cookies, platform);
export const POST: RequestHandler = ({ cookies, platform }) => logout(cookies, platform);
