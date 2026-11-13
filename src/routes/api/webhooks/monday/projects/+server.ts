import { syncProjectEventsFromMonday } from '$lib/server/events/sync';
import { PROJECT_BOARD_ID } from '$lib/server/monday/events';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type MondayWebhookPayload = {
	challenge?: unknown;
	event?: {
		boardId?: unknown;
		pulseId?: unknown;
		type?: unknown;
	};
};

function isWebhookPayload(value: unknown): value is MondayWebhookPayload {
	return Boolean(value && typeof value === 'object');
}

function callbackToken(url: URL): string {
	const queryToken = url.searchParams.get('token');
	if (queryToken) return queryToken;

	const tokenPathPrefix = '/api/webhooks/monday/projects/';
	if (!url.pathname.startsWith(tokenPathPrefix)) return '';
	return decodeURIComponent(url.pathname.slice(tokenPathPrefix.length));
}

export const GET: RequestHandler = async () =>
	json(
		{ status: 'ready' },
		{
			headers: {
				'cache-control': 'no-store'
			}
		}
	);

export const HEAD: RequestHandler = async () =>
	new Response(null, {
		status: 200,
		headers: {
			'cache-control': 'no-store'
		}
	});

export const POST: RequestHandler = async ({ platform, request, url }) => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		error(400, 'Expected a JSON webhook payload.');
	}

	if (!isWebhookPayload(payload)) error(400, 'Invalid webhook payload.');
	if (typeof payload.challenge === 'string') {
		console.info(
			JSON.stringify({
				event: 'monday_project_webhook_challenge_received',
				contentType: request.headers.get('content-type') ?? '',
				userAgent: request.headers.get('user-agent') ?? ''
			})
		);
		return json({ challenge: payload.challenge });
	}

	const secret = platform?.env.MONDAY_PROJECT_WEBHOOK_SECRET;
	if (!secret) error(503, 'Monday project webhook is not configured.');
	if (callbackToken(url) !== secret) error(401, 'Invalid webhook token.');

	const boardId = String(payload.event?.boardId ?? '');
	if (boardId !== PROJECT_BOARD_ID) return new Response(null, { status: 204 });
	console.info(
		JSON.stringify({
			event: 'monday_project_webhook_sync_requested',
			projectId: String(payload.event?.pulseId ?? ''),
			type: String(payload.event?.type ?? '')
		})
	);

	platform.ctx.waitUntil(
		syncProjectEventsFromMonday(platform.env).catch((cause) => {
			console.error(
				JSON.stringify({
					event: 'monday_project_webhook_sync_failed',
					projectId: String(payload.event?.pulseId ?? ''),
					message: cause instanceof Error ? cause.message : 'Unknown error'
				})
			);
		})
	);

	return new Response(null, { status: 202 });
};
