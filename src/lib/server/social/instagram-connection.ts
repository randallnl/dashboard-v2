import {
	SocialPlatformConnectionRepository,
	type InstagramConnectionCandidate
} from '$lib/server/db';

const META_AUTHORIZE_URL = 'https://www.facebook.com/dialog/oauth';
const META_GRAPH_URL = 'https://graph.facebook.com';
const TOKEN_KEY_BYTES = 32;
const DEFAULT_SCOPES = [
	'pages_show_list',
	'pages_read_engagement',
	'instagram_basic',
	'instagram_content_publish'
];

export type InstagramConnectionEnv = {
	DB: D1Database;
	DASHBOARD_URL: string;
	META_APP_ID?: string;
	META_APP_SECRET?: string;
	SOCIAL_TOKEN_ENCRYPTION_KEY?: string;
};

type MetaTokenResponse = {
	access_token?: string;
};

type MetaPage = {
	id?: string;
	name?: string;
	access_token?: string;
	instagram_business_account?: { id?: string; username?: string };
};

type MetaPagesResponse = {
	data?: MetaPage[];
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

async function encryptPageAccessToken(value: string, env: InstagramConnectionEnv): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const cipher = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: copyArrayBuffer(iv) },
		await encryptionKey(env),
		copyArrayBuffer(new TextEncoder().encode(value))
	);
	return `${base64UrlEncode(iv)}.${base64UrlEncode(cipher)}`;
}

function requiredConfig(env: InstagramConnectionEnv): { appId: string; appSecret: string } {
	const appId = env.META_APP_ID?.trim() || '';
	const appSecret = env.META_APP_SECRET?.trim() || '';
	if (!appId || !appSecret || !env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim()) {
		throw new Error('Instagram publishing connection is not configured.');
	}
	return { appId, appSecret };
}

export function instagramOAuthConfigured(env: InstagramConnectionEnv): boolean {
	return Boolean(
		env.META_APP_ID?.trim() &&
		env.META_APP_SECRET?.trim() &&
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
	const { appId } = requiredConfig(env);
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
		redirect_uri: instagramRedirectUri(env),
		response_type: 'code',
		state,
		scope: DEFAULT_SCOPES.join(',')
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

async function listInstagramPageCandidates(
	env: InstagramConnectionEnv,
	userAccessToken: string
): Promise<
	Array<
		Pick<
			InstagramConnectionCandidate,
			| 'facebookPageId'
			| 'facebookPageName'
			| 'instagramAccountId'
			| 'instagramUsername'
			| 'encryptedPageAccessToken'
		>
	>
> {
	const url = new URL('/me/accounts', META_GRAPH_URL);
	url.search = new URLSearchParams({
		fields: 'id,name,access_token,instagram_business_account{id,username}',
		access_token: userAccessToken
	}).toString();
	const response = await fetch(url, { headers: { accept: 'application/json' } });
	if (!response.ok) throw new Error(`Meta Page lookup failed (${response.status}).`);
	const payload = (await response.json()) as MetaPagesResponse;
	const candidates = await Promise.all(
		(payload.data ?? []).map(async (page) => {
			const instagram = page.instagram_business_account;
			if (!page.id || !page.access_token || !instagram?.id) return null;
			return {
				facebookPageId: page.id,
				facebookPageName: page.name?.trim() || 'Facebook Page',
				instagramAccountId: instagram.id,
				instagramUsername: instagram.username?.trim() || '',
				encryptedPageAccessToken: await encryptPageAccessToken(page.access_token, env)
			};
		})
	);
	return candidates.filter(
		(
			candidate
		): candidate is Pick<
			InstagramConnectionCandidate,
			| 'facebookPageId'
			| 'facebookPageName'
			| 'instagramAccountId'
			| 'instagramUsername'
			| 'encryptedPageAccessToken'
		> => candidate !== null
	);
}

export async function completeInstagramAuthorization(
	env: InstagramConnectionEnv,
	input: { code: string; memberId: string }
): Promise<{ connected: boolean }> {
	const userAccessToken = await exchangeAuthorizationCode(env, input.code);
	const candidates = await listInstagramPageCandidates(env, userAccessToken);
	if (!candidates.length) {
		throw new Error(
			'Meta did not return a Facebook Page linked to an Instagram professional account. Link the account to a Page, then try again.'
		);
	}
	const now = new Date();
	const repository = new SocialPlatformConnectionRepository(env.DB);
	if (candidates.length === 1) {
		const candidate = candidates[0];
		await repository.saveInstagramConnection({
			...candidate,
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
	input: { selectionId: string; facebookPageId: string; memberId: string }
): Promise<boolean> {
	const candidate = await new SocialPlatformConnectionRepository(env.DB).consumeInstagramCandidate({
		selectionId: input.selectionId,
		facebookPageId: input.facebookPageId,
		createdByMemberId: input.memberId,
		now: new Date().toISOString()
	});
	if (!candidate) return false;
	await new SocialPlatformConnectionRepository(env.DB).saveInstagramConnection({
		instagramAccountId: candidate.instagramAccountId,
		instagramUsername: candidate.instagramUsername,
		facebookPageId: candidate.facebookPageId,
		facebookPageName: candidate.facebookPageName,
		encryptedPageAccessToken: candidate.encryptedPageAccessToken,
		connectedByMemberId: input.memberId,
		now: new Date().toISOString()
	});
	return true;
}
