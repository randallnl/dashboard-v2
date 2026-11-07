import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MODERATION_STATUSES = new Set(['approved', 'not_displayed', 'disqualified']);

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	const body = (await request.json().catch(() => null)) as { status?: string; note?: string } | null;
	const status = body?.status || '';
	const note = (body?.note || '').trim().slice(0, 1_000);
	if (!MODERATION_STATUSES.has(status)) error(400, 'Invalid moderation status.');
	const submission = await env!.DB.prepare('SELECT status FROM calendar_campaign_submissions WHERE id = ?1').bind(params.id).first<{ status: string }>();
	if (!submission) error(404, 'Submission not found.');
	if (status === 'disqualified' && !note) error(400, 'A disqualification requires an official-rules reason.');
	const now = new Date().toISOString();
	await env!.DB.batch([
		env!.DB.prepare('UPDATE calendar_campaign_submissions SET status = ?2, disqualification_reason = ?3, updated_at = ?4 WHERE id = ?1').bind(params.id, status, status === 'disqualified' ? note : '', now),
		env!.DB.prepare('INSERT INTO calendar_campaign_moderation_audit (id, submission_id, action, previous_status, new_status, note, actor_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(crypto.randomUUID(), params.id, 'moderated', submission.status, status, note, context.viewer.id, now),
		...(status === 'disqualified' ? [env!.DB.prepare('UPDATE calendar_campaign_giveaway_entries SET eligible = 0, disqualified_at = ?2, disqualification_reason = ?3 WHERE submission_id = ?1').bind(params.id, now, note)] : [])
	]);
	return json({ message: 'Moderation decision saved.' });
};
