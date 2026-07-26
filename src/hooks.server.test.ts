import { describe, expect, it } from 'vitest';
import { applyResponseHeaders } from './hooks.server';

describe('request boundary headers', () => {
	it('adds a correlation ID and baseline browser security headers', () => {
		const response = applyResponseHeaders(new Response('ok'), 'request-123');

		expect(response.headers.get('x-request-id')).toBe('request-123');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('x-frame-options')).toBe('DENY');
		expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
	});
});
