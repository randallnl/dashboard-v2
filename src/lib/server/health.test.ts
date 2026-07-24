import { describe, expect, it } from 'vitest';
import { getHealth } from './health';

describe('getHealth', () => {
	it('reports missing bindings without exposing values', () => {
		expect(getHealth(undefined)).toEqual({
			status: 'ok',
			service: 'dashboard-v2',
			environment: 'unknown',
			bindings: {
				DB: { configured: false },
				MONDAY_API_TOKEN: { configured: false },
				EMAIL: { configured: false },
				LOGIN_FROM_EMAIL: { configured: false },
				LOGIN_FROM_NAME: { configured: false }
			}
		});
	});

	it('reports configured bindings by name only', () => {
		const result = getHealth({
			ENVIRONMENT: 'test',
			DB: {},
			MONDAY_API_TOKEN: 'do-not-return',
			EMAIL: {},
			LOGIN_FROM_EMAIL: 'login@example.com',
			LOGIN_FROM_NAME: 'CoLab'
		});

		expect(result.environment).toBe('test');
		expect(Object.values(result.bindings).every(({ configured }) => configured)).toBe(true);
		expect(JSON.stringify(result)).not.toContain('do-not-return');
		expect(JSON.stringify(result)).not.toContain('login@example.com');
	});
});
