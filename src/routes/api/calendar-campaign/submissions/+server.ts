import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const clean = (value: FormDataEntryValue | null, max: number) =>
	typeof value === 'string' ? value.trim().slice(0, max) : '';

const escapeHtml = (value: string) =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');

function submissionConfirmation(name: string, hasPhoto: boolean) {
	const greeting = `Hi ${name},`;
	const photoLine = hasPhoto
		? 'We received your love note and photo.'
		: 'We received your love note.';
	const body = `${photoLine} Your eligible giveaway entry has been created. We’ll review submissions before anything is shared on the public Love Wall. A decision about public display will not affect giveaway eligibility unless a submission is independently disqualified under the official rules.`;
	return {
		subject: 'We received your Things We Love About New Hampshire submission',
		text: `${greeting}\n\n${body}\n\nThank you for helping us celebrate what we love about New Hampshire and build together.\n\nQueerlective CoLab`,
		html: `<p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(photoLine)} Your eligible giveaway entry has been created.</p><p>We’ll review submissions before anything is shared on the public Love Wall. A decision about public display will not affect giveaway eligibility unless a submission is independently disqualified under the <a href="https://dashboard.queerlective.com/things-we-love/rules">official rules</a>.</p><p>Thank you for helping us celebrate what we love about New Hampshire and build together.</p><p>Queerlective CoLab</p>`
	};
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;
	if (!env?.DB) error(503, 'Submissions are not available right now.');
	const form = await request.formData();
	const name = clean(form.get('name'), 120);
	const email = clean(form.get('email'), 254).toLowerCase();
	const town = clean(form.get('town'), 120);
	const story = clean(form.get('story'), 2_000);
	const publicDisplayConsent = form.get('publicDisplayConsent') === 'on';
	const calendarPublicationConsent = form.get('calendarPublicationConsent') === 'on';
	const imageEditConsent = form.get('imageEditConsent') === 'on';
	const rulesAccepted = form.get('rulesAccepted') === 'on';
	const photo = form.get('photo');
	if (!name || !/^\S+@\S+\.\S+$/.test(email) || !story || !rulesAccepted) {
		error(400, 'Please provide your name, a valid email, your story, and acceptance of the official rules.');
	}
	if (photo instanceof File && photo.size) {
		if (!ALLOWED_IMAGE_TYPES.has(photo.type) || photo.size > MAX_IMAGE_BYTES) {
			error(400, 'Photos must be JPG, PNG, or WebP and 10 MB or smaller.');
		}
		if (!imageEditConsent) {
			error(400, 'Photo submissions require permission for cropping, resizing, and text overlays.');
		}
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	let imageKey = '';
	if (photo instanceof File && photo.size) {
		if (!env.CALENDAR_CAMPAIGN_ASSETS) error(503, 'Photo submissions are not available right now.');
		const extension = photo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'image';
		imageKey = `calendar-campaign/${id}/original.${extension}`;
		await env.CALENDAR_CAMPAIGN_ASSETS.put(imageKey, await photo.arrayBuffer(), {
			httpMetadata: { contentType: photo.type }
		});
	}
	await env.DB.batch([
		env.DB
			.prepare(
				`INSERT INTO calendar_campaign_submissions (
					id, name, email, town, story, image_key, image_filename, image_content_type,
					public_display_consent, calendar_publication_consent, image_edit_consent, rules_accepted,
					created_at, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1, ?12, ?12)`
			)
			.bind(id, name, email, town, story, imageKey, photo instanceof File ? photo.name : '', photo instanceof File ? photo.type : '', Number(publicDisplayConsent), Number(calendarPublicationConsent), Number(imageEditConsent), now),
		env.DB
			.prepare('INSERT INTO calendar_campaign_giveaway_entries (id, submission_id, created_at) VALUES (?1, ?2, ?3)')
			.bind(crypto.randomUUID(), id, now),
		env.DB
			.prepare(`INSERT INTO calendar_campaign_moderation_audit (id, submission_id, action, new_status, note, created_at) VALUES (?1, ?2, 'submitted', 'pending', 'Giveaway entry created automatically.', ?3)`)
			.bind(crypto.randomUUID(), id, now)
	]);
	if (env.EMAIL) {
		const confirmation = submissionConfirmation(name, photo instanceof File && photo.size > 0);
		await env.EMAIL.send({
			to: email,
			cc: 'randall@queerlective.com',
			from: {
				email: env.LOGIN_FROM_EMAIL || 'dashboard@nhciviccommons.com',
				name: env.LOGIN_FROM_NAME || 'Queerlective CoLab'
			},
			subject: confirmation.subject,
			text: confirmation.text,
			html: confirmation.html
		}).catch((emailError) => console.error('Calendar campaign confirmation email failed', emailError));
	}
	return json({ id, message: 'Thank you — your submission and giveaway entry are in. A confirmation email is on its way.' }, { status: 201 });
};
