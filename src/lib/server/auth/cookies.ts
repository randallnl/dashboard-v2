import type { Cookies } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, SESSION_LIFETIME_MS } from './config';

const SESSION_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const
};

export function setSessionCookie(cookies: Cookies, token: string): void {
	cookies.set(SESSION_COOKIE_NAME, token, {
		...SESSION_COOKIE_OPTIONS,
		maxAge: Math.floor(SESSION_LIFETIME_MS / 1000)
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
}
