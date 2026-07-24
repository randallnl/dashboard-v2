const DEFAULT_TOKEN_BYTES = 32;

export type OpaqueToken = {
	value: string;
	hash: string;
};

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export async function hashToken(value: string): Promise<string> {
	const input = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', input);
	return toBase64Url(new Uint8Array(digest));
}

export async function createOpaqueToken(byteLength = DEFAULT_TOKEN_BYTES): Promise<OpaqueToken> {
	if (!Number.isInteger(byteLength) || byteLength < DEFAULT_TOKEN_BYTES) {
		throw new RangeError(`Token length must be at least ${DEFAULT_TOKEN_BYTES} bytes`);
	}

	const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
	const value = toBase64Url(bytes);

	return {
		value,
		hash: await hashToken(value)
	};
}

export function expiresAt(durationMs: number, now = new Date()): string {
	if (!Number.isFinite(durationMs) || durationMs <= 0) {
		throw new RangeError('Token duration must be a positive number');
	}

	return new Date(now.getTime() + durationMs).toISOString();
}
