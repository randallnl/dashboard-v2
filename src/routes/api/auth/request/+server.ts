import { requestMagicLink } from '$lib/server/auth/service';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ACCEPTED_RESPONSE = {
	ok: true,
	message: 'If that email belongs to a CoLab member, a sign-in link is on its way.'
};

export const POST: RequestHandler = async ({ request, platform, url }) => {
	const env = platform?.env;
	if (!env) {
		return json({ ok: false, message: 'Sign-in is temporarily unavailable.' }, { status: 503 });
	}

	let email: string;
	try {
		const contentType = request.headers.get('content-type') ?? '';
		if (contentType.includes('application/json')) {
			const body = (await request.json()) as { email?: unknown };
			email = typeof body.email === 'string' ? body.email : '';
		} else {
			const form = await request.formData();
			const value = form.get('email');
			email = typeof value === 'string' ? value : '';
		}
	} catch {
		return json(ACCEPTED_RESPONSE);
	}

	try {
		await requestMagicLink(env, email, url.origin);
		return json(ACCEPTED_RESPONSE);
	} catch (cause) {
		console.error(
			JSON.stringify({
				event: 'magic_link_request_failed',
				message: cause instanceof Error ? cause.message : 'Unknown error'
			})
		);
		return json({ ok: false, message: 'Sign-in is temporarily unavailable.' }, { status: 503 });
	}
};
