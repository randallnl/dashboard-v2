import type { InstagramConnection } from '$lib/server/db';
import type { SocialPostAsset } from '$lib/types/domain';
import {
	decryptInstagramAccessToken,
	type InstagramConnectionEnv
} from './instagram-connection';

const META_GRAPH_URL = 'https://graph.facebook.com';
const META_GRAPH_VERSION = 'v27.0';
const TOKEN_KEY_BYTES = 32;
const MEDIA_URL_TTL_SECONDS = 15 * 60;
const SIGNING_LABEL = 'queerlective-social-media-url-v1\0';

type MetaErrorPayload = {
	error?: { code?: number; message?: string };
	message?: string;
	id?: string;
	permalink?: string;
};

export class InstagramPublishError extends Error {}

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

function isValidTokenKey(value: Uint8Array): boolean {
	return value.byteLength === TOKEN_KEY_BYTES;
}

async function mediaUrlSigningKey(env: InstagramConnectionEnv): Promise<CryptoKey> {
	const encodedKey = env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim() || '';
	if (!encodedKey) throw new Error('Social account token encryption is not configured.');
	const tokenKey = base64UrlDecode(encodedKey);
	if (!isValidTokenKey(tokenKey)) {
		throw new Error('Social account token encryption key must contain 32 bytes.');
	}
	const label = new TextEncoder().encode(SIGNING_LABEL);
	const material = new Uint8Array(label.byteLength + tokenKey.byteLength);
	material.set(label);
	material.set(tokenKey, label.byteLength);
	const derived = await crypto.subtle.digest('SHA-256', material);
	return crypto.subtle.importKey(
		'raw',
		derived,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

function signedMediaPayload(assetId: string, expiresAt: number): Uint8Array {
	return new TextEncoder().encode(`${assetId}.${expiresAt}`);
}

async function signMediaPayload(
	env: InstagramConnectionEnv,
	assetId: string,
	expiresAt: number
): Promise<string> {
	return base64UrlEncode(
		await crypto.subtle.sign(
			'HMAC',
			await mediaUrlSigningKey(env),
			copyArrayBuffer(signedMediaPayload(assetId, expiresAt))
		)
	);
}

export function isInstagramPublishableImage(asset: SocialPostAsset): boolean {
	return (
		asset.storage === 'r2' &&
		(asset.contentType.toLocaleLowerCase() === 'image/jpeg' || /\.jpe?g$/iu.test(asset.filename))
	);
}

export async function createInstagramMediaUrl(
	env: InstagramConnectionEnv,
	assetId: string,
	now = Date.now()
): Promise<string> {
	const expiresAt = Math.floor(now / 1000) + MEDIA_URL_TTL_SECONDS;
	const url = new URL(
		`/api/social/instagram/media/${encodeURIComponent(assetId)}`,
		env.DASHBOARD_URL
	);
	url.searchParams.set('expires', String(expiresAt));
	url.searchParams.set('signature', await signMediaPayload(env, assetId, expiresAt));
	return url.toString();
}

export async function verifyInstagramMediaUrl(
	env: InstagramConnectionEnv,
	assetId: string,
	expiresAt: string | null,
	signature: string | null,
	now = Date.now()
): Promise<boolean> {
	const expires = Number(expiresAt);
	if (!Number.isSafeInteger(expires) || expires < Math.floor(now / 1000) || !signature) return false;
	try {
		return crypto.subtle.verify(
			'HMAC',
			await mediaUrlSigningKey(env),
			copyArrayBuffer(base64UrlDecode(signature)),
			copyArrayBuffer(signedMediaPayload(assetId, expires))
		);
	} catch {
		return false;
	}
}

function metaErrorMessage(payload: MetaErrorPayload | null, status: number): string {
	if (payload?.error?.code === 9007) {
		return 'Instagram is still preparing this visual. Wait a moment and try publishing again.';
	}
	const message = payload?.error?.message || payload?.message;
	return message ? `Instagram could not publish this post: ${message}` : `Instagram could not publish this post (${status}).`;
}

async function metaPayload(response: Response): Promise<MetaErrorPayload | null> {
	return response.json().catch(() => null) as Promise<MetaErrorPayload | null>;
}

async function createMediaContainer(input: {
	connection: InstagramConnection;
	accessToken: string;
	caption: string;
	imageUrl: string;
}): Promise<string> {
	const url = new URL(`/${META_GRAPH_VERSION}/${input.connection.instagramAccountId}/media`, META_GRAPH_URL);
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
		body: new URLSearchParams({
			image_url: input.imageUrl,
			caption: input.caption,
			access_token: input.accessToken
		})
	});
	const payload = await metaPayload(response);
	if (!response.ok || !payload?.id) throw new InstagramPublishError(metaErrorMessage(payload, response.status));
	return payload.id;
}

async function publishMediaContainer(input: {
	connection: InstagramConnection;
	accessToken: string;
	containerId: string;
}): Promise<string> {
	const url = new URL(
		`/${META_GRAPH_VERSION}/${input.connection.instagramAccountId}/media_publish`,
		META_GRAPH_URL
	);
	const retryDelays = [750, 1250, 2000, 3000];
	for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
			body: new URLSearchParams({
				creation_id: input.containerId,
				access_token: input.accessToken
			})
		});
		const payload = await metaPayload(response);
		if (response.ok && payload?.id) return payload.id;
		if (payload?.error?.code !== 9007 || attempt === retryDelays.length) {
			throw new InstagramPublishError(metaErrorMessage(payload, response.status));
		}
		await new Promise<void>((resolve) => setTimeout(resolve, retryDelays[attempt]));
	}
	throw new InstagramPublishError('Instagram could not publish this post.');
}

async function publishedPermalink(input: {
	mediaId: string;
	accessToken: string;
}): Promise<string> {
	const url = new URL(`/${META_GRAPH_VERSION}/${input.mediaId}`, META_GRAPH_URL);
	url.search = new URLSearchParams({ fields: 'permalink', access_token: input.accessToken }).toString();
	const response = await fetch(url, { headers: { accept: 'application/json' } });
	if (!response.ok) return '';
	const payload = await metaPayload(response);
	return payload?.permalink?.trim() || '';
}

export async function publishInstagramImage(input: {
	env: InstagramConnectionEnv;
	connection: InstagramConnection;
	asset: SocialPostAsset;
	caption: string;
}): Promise<{ mediaId: string; permalink: string }> {
	if (!isInstagramPublishableImage(input.asset)) {
		throw new InstagramPublishError('Attach a JPG visual before publishing to Instagram.');
	}
	if (!input.caption.trim()) throw new InstagramPublishError('Add an Instagram caption before publishing.');
	const accessToken = await decryptInstagramAccessToken(input.connection.encryptedAccessToken, input.env);
	const containerId = await createMediaContainer({
		connection: input.connection,
		accessToken,
		caption: input.caption,
		imageUrl: await createInstagramMediaUrl(input.env, input.asset.id)
	});
	const mediaId = await publishMediaContainer({
		connection: input.connection,
		accessToken,
		containerId
	});
	return { mediaId, permalink: await publishedPermalink({ mediaId, accessToken }) };
}
