import {
	SocialPlatformConnectionRepository,
	type InstagramConnectionCandidate
} from '$lib/server/db';

const META_AUTHORIZE_URL = 'https://www.facebook.com/dialog/oauth';
const META_GRAPH_URL = 'https://graph.facebook.com';
const TOKEN_KEY_BYTES = 32;

export type InstagramConnectionEnv = {
	DB: D1Database;
	DASHBOARD_URL: string;
	META_APP_ID?: string;
	META_APP_SECRET?: string;
	META_UNIFIED_LOGIN_CONFIG_ID?: string;
	SOCIAL_TOKEN_ENCRYPTION_KEY?: string;
};

type MetaTokenResponse = {
	access_token?: string;
};

type MetaInstagramAccount = {
	id?: string;
	username?: string;
};

type MetaInstagramAccountsResponse = {
	data?: MetaInstagramAccount[];
};

function base64UrlEncode(value: ArrayBuffer | Uint8Array): string {
	const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlDecode(value: string): Uint8Array {
	const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
	const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(`${normalized}${padding}`);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

function copyArrayBuffer(value: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(value.byteLength);
	copy.set(value);
	return copy.buffer;
}

async function stateHash(value: string): Promise<string> {
	return base64UrlEncode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function encryptionKey(env: InstagramConnectionEnv): Promise<CryptoKey> {
	const value = env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim() || '';
	if (!value) throw new Error('Social account token encryption is not configured.');
	const bytes = base64UrlDecode(value);
	if (bytes.byteLength !== TOKEN_KEY_BYTES) {
		throw new Error('Social account token encryption key must contain 32 bytes.');
	}
	return crypto.subtle.importKey('raw', copyArrayBuffer(bytes), { name: 'AES-GCM' }, false, [
		'encrypt',
		'decrypt'
	]);
}

async function encryptAccessToken(value: string, env: InstagramConnectionEnv): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const cipher = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: copyArrayBuffer(iv) },
		await encryptionKey(env),
		copyArrayBuffer(new TextEncoder().encode(value))
	);
	return `${base64UrlEncode(iv)}.${base64UrlEncode(cipher)}`;
}

export async function decryptInstagramAccessToken(
	value: string,
	env: InstagramConnectionEnv
): Promise<string> {
	const [encodedIv, encodedCiphertext, unexpectedPart] = value.split('.');
	if (!encodedIv || !encodedCiphertext || unexpectedPart) {
		throw new Error('The saved Instagram connection is invalid. Connect the account again.');
	}
	try {
		const plaintext = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: copyArrayBuffer(base64UrlDecode(encodedIv)) },
			await encryptionKey(env),
			copyArrayBuffer(base64UrlDecode(encodedCiphertext))
		);
		const token = new TextDecoder().decode(plaintext).trim();
		if (!token) throw new Error('Empty token');
		return token;
	} catch {
		throw new Error('The saved Instagram connection could not be read. Connect the account again.');
	}
}

function requiredConfig(env: InstagramConnectionEnv): {
	appId: string;
	appSecret: string;
	configurationId: string;
} {
	const appId = env.META_APP_ID?.trim() || '';
	const appSecret = env.META_APP_SECRET?.trim() || '';
	const configurationId = env.META_UNIFIED_LOGIN_CONFIG_ID?.trim() || '';
	if (!appId || !appSecret || !configurationId || !env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim()) {
		throw new Error('Instagram publishing connection is not configured.');
	}
	return { appId, appSecret, configurationId };
}

export function instagramOAuthConfigured(env: InstagramConnectionEnv): boolean {
	return Boolean(
		env.META_APP_ID?.trim() &&
		env.META_APP_SECRET?.trim() &&
		env.META_UNIFIED_LOGIN_CONFIG_ID?.trim() &&
		env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim()
	);
}

export function instagramRedirectUri(env: InstagramConnectionEnv): string {
	return new URL('/api/social/instagram/callback', env.DASHBOARD_URL).toString();
}

export async function createInstagramAuthorizationUrl(
	env: InstagramConnectionEnv,
	memberId: string
): Promise<string> {
	const { appId, configurationId } = requiredConfig(env);
	const state = crypto.randomUUID();
	const now = new Date();
	await new SocialPlatformConnectionRepository(env.DB).createInstagramOAuthState({
		stateHash: await stateHash(state),
		createdByMemberId: memberId,
		expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
		createdAt: now.toISOString()
	});
	const url = new URL(META_AUTHORIZE_URL);
	url.search = new URLSearchParams({
		client_id: appId,
		config_id: configurationId,
		display: 'popup',
		override_default_response_type: 'true',
		redirect_uri: instagramRedirectUri(env),
		response_type: 'code',
		state,
		prompt: 'login'
	}).toString();
	return url.toString();
}

export async function consumeInstagramAuthorizationState(
	env: InstagramConnectionEnv,
	state: string
): Promise<string | null> {
	return new SocialPlatformConnectionRepository(env.DB).consumeInstagramOAuthState(
		await stateHash(state),
		new Date().toISOString()
	);
}

async function exchangeAuthorizationCode(
	env: InstagramConnectionEnv,
	code: string
): Promise<string> {
	const { appId, appSecret } = requiredConfig(env);
	const url = new URL('/oauth/access_token', META_GRAPH_URL);
	url.search = new URLSearchParams({
		client_id: appId,
		client_secret: appSecret,
		redirect_uri: instagramRedirectUri(env),
		code
	}).toString();
	const response = await fetch(url, { headers: { accept: 'application/json' } });
	if (!response.ok) throw new Error(`Meta authorization failed (${response.status}).`);
	const payload = (await response.json()) as MetaTokenResponse;
	if (!payload.access_token) throw new Error('Meta authorization returned incomplete credentials.');
	return payload.access_token;
}

async function listAssignedInstagramAccountCandidates(
	env: InstagramConnectionEnv,
	systemUserAccessToken: string
): Promise<
	Array<
		Pick<
			InstagramConnectionCandidate,
			| 'accountId'
			| 'accountLabel'
			| 'instagramAccountId'
			| 'instagramUsername'
			| 'encryptedAccessToken'
		>
	>
> {
	const url = new URL('/me/assigned_instagram_accounts', META_GRAPH_URL);
	url.search = new URLSearchParams({
		fields: 'id,username',
		access_token: systemUserAccessToken
	}).toString();
	const response = await fetch(url, { headers: { accept: 'application/json' } });
	if (!response.ok) throw new Error(`Meta Instagram account lookup failed (${response.status}).`);
	const payload = (await response.json()) as MetaInstagramAccountsResponse;
	const candidates = await Promise.all(
		(payload.data ?? []).map(async (instagram) => {
			if (!instagram.id) return null;
			return {
				accountId: instagram.id,
				accountLabel: 'Meta Unified Login',
				instagramAccountId: instagram.id,
				instagramUsername: instagram.username?.trim() || '',
				encryptedAccessToken: await encryptAccessToken(systemUserAccessToken, env)
			};
		})
	);
	return candidates.filter(
		(
			candidate
		): candidate is Pick<
			InstagramConnectionCandidate,
			| 'accountId'
			| 'accountLabel'
			| 'instagramAccountId'
			| 'instagramUsername'
			| 'encryptedAccessToken'
		> => candidate !== null
	);
}

export async function completeInstagramAuthorization(
	env: InstagramConnectionEnv,
	input: { code: string; memberId: string }
): Promise<{ connected: boolean }> {
	const systemUserAccessToken = await exchangeAuthorizationCode(env, input.code);
	const candidates = await listAssignedInstagramAccountCandidates(env, systemUserAccessToken);
	if (!candidates.length) {
		throw new Error(
			'Meta did not return an Instagram account assigned to the Unified Login configuration. Check the business portfolio, account selection, and business-management permission, then try again.'
		);
	}
	const now = new Date();
	const repository = new SocialPlatformConnectionRepository(env.DB);
	if (candidates.length === 1) {
		const candidate = candidates[0];
		await repository.saveInstagramConnection({
			instagramAccountId: candidate.instagramAccountId,
			instagramUsername: candidate.instagramUsername,
			connectionSourceId: candidate.accountId,
			connectionSourceName: candidate.accountLabel,
			encryptedAccessToken: candidate.encryptedAccessToken,
			connectedByMemberId: input.memberId,
			now: now.toISOString()
		});
		return { connected: true };
	}
	await repository.saveInstagramCandidates({
		selectionId: crypto.randomUUID(),
		candidates,
		createdByMemberId: input.memberId,
		expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
		createdAt: now.toISOString()
	});
	return { connected: false };
}

export async function selectInstagramConnectionCandidate(
	env: InstagramConnectionEnv,
	input: { selectionId: string; accountId: string; memberId: string }
): Promise<boolean> {
	const candidate = await new SocialPlatformConnectionRepository(env.DB).consumeInstagramCandidate({
		selectionId: input.selectionId,
		accountId: input.accountId,
		createdByMemberId: input.memberId,
		now: new Date().toISOString()
	});
	if (!candidate) return false;
	await new SocialPlatformConnectionRepository(env.DB).saveInstagramConnection({
		instagramAccountId: candidate.instagramAccountId,
		instagramUsername: candidate.instagramUsername,
		connectionSourceId: candidate.accountId,
		connectionSourceName: candidate.accountLabel,
		encryptedAccessToken: candidate.encryptedAccessToken,
		connectedByMemberId: input.memberId,
		now: new Date().toISOString()
	});
	return true;
}
