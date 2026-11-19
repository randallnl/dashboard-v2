import { describe, expect, it } from 'vitest';
import {
	createInstagramAuthorizationUrl,
	instagramOAuthConfigured,
	type InstagramConnectionEnv
} from './instagram-connection';

function connectionEnv(): InstagramConnectionEnv {
	const statement = {
		bind: () => ({ run: async () => ({}) })
	};
	return {
		DB: { prepare: () => statement } as unknown as D1Database,
		DASHBOARD_URL: 'https://dashboard.queerlective.com',
		META_APP_ID: 'meta-app-id',
		META_APP_SECRET: 'meta-app-secret',
		META_UNIFIED_LOGIN_CONFIG_ID: 'unified-login-config',
		SOCIAL_TOKEN_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
	};
}

describe('Unified Login configuration', () => {
	it('requires the Meta Unified Login configuration ID', () => {
		const env = connectionEnv();
		expect(instagramOAuthConfigured(env)).toBe(true);
		delete env.META_UNIFIED_LOGIN_CONFIG_ID;
		expect(instagramOAuthConfigured(env)).toBe(false);
	});

	it('creates a Unified Login authorization URL without legacy scopes', async () => {
		const url = new URL(await createInstagramAuthorizationUrl(connectionEnv(), 'member-id'));
		expect(url.origin + url.pathname).toBe('https://www.facebook.com/dialog/oauth');
		expect(url.searchParams.get('client_id')).toBe('meta-app-id');
		expect(url.searchParams.get('config_id')).toBe('unified-login-config');
		expect(url.searchParams.get('redirect_uri')).toBe(
			'https://dashboard.queerlective.com/api/social/instagram/callback'
		);
		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('override_default_response_type')).toBe('true');
		expect(url.searchParams.get('state')).toBeTruthy();
		expect(url.searchParams.has('scope')).toBe(false);
	});
});
