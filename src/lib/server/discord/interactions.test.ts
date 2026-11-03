import { describe, expect, it } from 'vitest';
import { discordConfigValue, verifyDiscordInteraction } from './interactions';

function toHex(value: ArrayBuffer): string {
	return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function encoded(value: string): ArrayBuffer {
	const bytes = new TextEncoder().encode(value);
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

describe('Discord interaction verification', () => {
	it('reads the same configuration from local variables and Secrets Store bindings', async () => {
		await expect(discordConfigValue('local-value')).resolves.toBe('local-value');
		await expect(discordConfigValue({ get: async () => 'stored-value' })).resolves.toBe(
			'stored-value'
		);
	});

	it('accepts only an Ed25519 signature for the exact timestamp and raw body', async () => {
		const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
		const rawBody = '{"type":1}';
		const timestamp = '1793652300';
		const [publicKey, signature] = await Promise.all([
			crypto.subtle.exportKey('raw', keyPair.publicKey),
			crypto.subtle.sign({ name: 'Ed25519' }, keyPair.privateKey, encoded(`${timestamp}${rawBody}`))
		]);

		await expect(
			verifyDiscordInteraction(rawBody, toHex(signature), timestamp, toHex(publicKey))
		).resolves.toBe(true);
		await expect(
			verifyDiscordInteraction('{"type": 1}', toHex(signature), timestamp, toHex(publicKey))
		).resolves.toBe(false);
	});
});
