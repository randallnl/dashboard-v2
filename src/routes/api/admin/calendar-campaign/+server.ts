import { loadMemberContext, requireAdmin } from '$lib/server/auth/member-context';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const STATUSES = new Set(['pending', 'approved', 'not_displayed', 'disqualified']);

type SubmissionRow = {
	id: string;
	name: string;
	email: string;
	town: string;
	instagram_handle: string;
	story: string;
	image_key: string;
	created_at: string;
	status: string;
	public_display_consent: number;
	calendar_publication_consent: number;
	image_edit_consent: number;
	disqualification_reason: string;
};

type AuditRow = {
	id: string;
	submission_id: string;
	action: string;
	previous_status: string;
	new_status: string;
	note: string;
	actor_id: string;
	created_at: string;
};

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	if (!env?.DB) error(503, 'Moderation is unavailable right now.');

	const requestedStatus = url.searchParams.get('status')?.trim() || 'pending';
	if (requestedStatus !== 'all' && !STATUSES.has(requestedStatus)) error(400, 'Invalid status filter.');
	const search = (url.searchParams.get('search')?.trim() || '').slice(0, 120);
	const where = [requestedStatus === 'all' ? '1 = 1' : 'status = ?1'];
	const bindings: string[] = requestedStatus === 'all' ? [] : [requestedStatus];
	if (search) {
		where.push(`(name LIKE ?${bindings.length + 1} OR email LIKE ?${bindings.length + 1} OR town LIKE ?${bindings.length + 1} OR story LIKE ?${bindings.length + 1})`);
		bindings.push(`%${search}%`);
	}
	const results = await env.DB
		.prepare(`SELECT id, name, email, town, instagram_handle, story, image_key, created_at, status, public_display_consent, calendar_publication_consent, image_edit_consent, disqualification_reason FROM calendar_campaign_submissions WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 100`)
		.bind(...bindings)
		.all<SubmissionRow>();
	const ids = results.results.map((submission) => submission.id);
	const audits = ids.length
		? await env.DB
				.prepare(`SELECT id, submission_id, action, previous_status, new_status, note, actor_id, created_at FROM calendar_campaign_moderation_audit WHERE submission_id IN (${ids.map(() => '?').join(', ')}) ORDER BY created_at DESC`)
				.bind(...ids)
				.all<AuditRow>()
		: { results: [] as AuditRow[] };
	const auditBySubmission = new Map<string, AuditRow[]>();
	for (const audit of audits.results) {
		const current = auditBySubmission.get(audit.submission_id) || [];
		current.push(audit);
		auditBySubmission.set(audit.submission_id, current);
	}
	return json({
		submissions: results.results.map((submission) => ({
			...submission,
			hasPhoto: Boolean(submission.image_key),
			audits: auditBySubmission.get(submission.id) || []
		}))
	}, { headers: { 'cache-control': 'private, no-store' } });
};
