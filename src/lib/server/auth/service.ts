import { AuthRepository, MemberRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory, normalizeEmail } from '$lib/server/monday/members';
import { createOpaqueToken, expiresAt, hashToken } from '$lib/server/security/tokens';
import {
	AUTH_RATE_LIMIT_MAX_REQUESTS,
	AUTH_RATE_LIMIT_WINDOW_MS,
	MAGIC_LINK_LIFETIME_MS
} from './config';
import { sendMagicLinkEmail } from './email';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type MagicLinkRequestResult = {
	accepted: true;
};

export function isPlausibleEmail(value: string): boolean {
	return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export async function requestMagicLink(
	env: Env,
	emailInput: string,
	origin: string,
	now = new Date()
): Promise<MagicLinkRequestResult> {
	const email = normalizeEmail(emailInput);
	const repository = new AuthRepository(env.DB);
	const nowIso = now.toISOString();
	const rateKey = await hashToken(`auth-request:${email}`);
	const windowCutoff = new Date(now.getTime() - AUTH_RATE_LIMIT_WINDOW_MS).toISOString();
	const requestCount = await repository.recordAuthRequest(rateKey, nowIso, windowCutoff);

	if (requestCount > AUTH_RATE_LIMIT_MAX_REQUESTS || !isPlausibleEmail(email)) {
		return { accepted: true };
	}

	const memberRepository = new MemberRepository(env.DB);
	let member = await memberRepository.findByEmail(email);
	if (!member) {
		const token = await mondayToken(env.MONDAY_API_TOKEN);
		member = await new MemberDirectory(new MondayClient(token)).findByEmail(email);
		if (member) await memberRepository.upsert(member, nowIso);
	}
	if (!member) {
		return { accepted: true };
	}

	const loginToken = await createOpaqueToken();
	await repository.invalidateLoginTokens(member.email, nowIso);
	await repository.createLoginToken({
		tokenHash: loginToken.hash,
		email: member.email,
		expiresAt: expiresAt(MAGIC_LINK_LIFETIME_MS, now)
	});

	const loginUrl = new URL('/api/auth/verify', origin);
	loginUrl.searchParams.set('token', loginToken.value);

	try {
		await sendMagicLinkEmail(env.EMAIL, env.LOGIN_FROM_EMAIL, env.LOGIN_FROM_NAME, {
			to: email,
			loginUrl: loginUrl.toString(),
			expiresInMinutes: Math.floor(MAGIC_LINK_LIFETIME_MS / 60_000)
		});
	} catch (error) {
		await repository.invalidateLoginTokens(member.email, nowIso);
		throw error;
	}

	return { accepted: true };
}
