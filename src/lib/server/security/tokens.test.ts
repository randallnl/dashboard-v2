import { describe, expect, it } from 'vitest';
import { createOpaqueToken, expiresAt, hashToken } from './tokens';

describe('token utilities', () => {
	it('creates a high-entropy URL-safe token and a separate deterministic hash', async () => {
		const first = await createOpaqueToken();
		const second = await createOpaqueToken();

		expect(first.value).toMatch(/^[A-Za-z0-9_-]{43}$/u);
		expect(first.hash).toMatch(/^[A-Za-z0-9_-]{43}$/u);
		expect(first.value).not.toBe(first.hash);
		expect(first.value).not.toBe(second.value);
		expect(await hashToken(first.value)).toBe(first.hash);
	});

	it('rejects tokens shorter than 256 bits', async () => {
		await expect(createOpaqueToken(31)).rejects.toThrow(RangeError);
	});

	it('produces UTC ISO expiration timestamps', () => {
		const now = new Date('2026-07-24T12:00:00.000Z');
		expect(expiresAt(15 * 60 * 1000, now)).toBe('2026-07-24T12:15:00.000Z');
	});
});
