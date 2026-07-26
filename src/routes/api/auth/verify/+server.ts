import { setSessionCookie } from '$lib/server/auth/cookies';
import { SESSION_LIFETIME_MS } from '$lib/server/auth/config';
import { AuthRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';
import { createOpaqueToken, expiresAt, hashToken } from '$lib/server/security/tokens';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function invalidLogin(): never {
	redirect(303, '/?auth=invalid');
}

export const GET: RequestHandler = async ({ cookies, platform, url }) => {
	const env = platform?.env;
	const tokenValue = url.searchParams.get('token') ?? '';
	if (!env || !/^[A-Za-z0-9_-]{43}$/u.test(tokenValue)) {
		invalidLogin();
	}

	const repository = new AuthRepository(env.DB);
	const now = new Date();
	const nowIso = now.toISOString();
	const tokenHash = await hashToken(tokenValue);
	const loginToken = await repository.findValidLoginToken(tokenHash, nowIso);
	if (!loginToken) {
		invalidLogin();
	}

	const mondayApiToken = await mondayToken(env.MONDAY_API_TOKEN);
	const member = await new MemberDirectory(new MondayClient(mondayApiToken)).findByEmail(
		loginToken.email
	);
	if (!member) {
		await repository.invalidateLoginTokens(loginToken.email, nowIso);
		invalidLogin();
	}

	const sessionToken = await createOpaqueToken();
	await repository.createSession({
		sessionHash: sessionToken.hash,
		email: member.email,
		memberId: member.id,
		expiresAt: expiresAt(SESSION_LIFETIME_MS, now)
	});

	const consumed = await repository.consumeLoginToken(tokenHash, nowIso);
	if (!consumed) {
		await repository.deleteSession(sessionToken.hash);
		invalidLogin();
	}

	setSessionCookie(cookies, sessionToken.value);
	platform.ctx.waitUntil(repository.cleanupExpired(nowIso));
	redirect(303, '/');
};
