import { getHealth } from '$lib/server/health';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ platform }) => {
	return json(getHealth(platform?.env), {
		headers: {
			'cache-control': 'no-store'
		}
	});
};
