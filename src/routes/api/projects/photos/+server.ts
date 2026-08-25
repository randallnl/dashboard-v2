import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import { ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { EventDirectory } from '$lib/server/monday/events';
import type { EventAttachment } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png']);

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const body = await request.formData();
	const projectId =
		typeof body.get('projectId') === 'string' ? String(body.get('projectId')).trim() : '';
	const photos = body.getAll('photos').filter((value): value is File => value instanceof File);
	if (!projectId || !/^\d+$/u.test(projectId)) error(400, 'A valid project is required.');
	if (!photos.length || photos.length > MAX_PHOTOS) {
		error(400, `Choose between 1 and ${MAX_PHOTOS} photos.`);
	}
	for (const photo of photos) {
		if (!IMAGE_TYPES.has(photo.type)) error(400, `${photo.name} must be a JPG, PNG, or GIF image.`);
		if (!photo.size || photo.size > MAX_PHOTO_BYTES) {
			error(400, `${photo.name} must be smaller than 10 MB.`);
		}
	}

	const projects = new ProjectEventRepository(env.DB);
	const project = await projects.findById('project', projectId);
	if (!project) error(404, 'Project not found.');
	const directory = new EventDirectory(new MondayClient(await mondayToken(env.MONDAY_API_TOKEN)));
	const uploaded: EventAttachment[] = [];
	for (const photo of photos) {
		const asset = await directory.uploadProjectPhoto(projectId, photo);
		uploaded.push({
			name: asset.name || photo.name,
			url: asset.publicUrl || asset.thumbnailUrl || asset.url,
			isImage: true
		});
	}

	const existing = Array.isArray(project.record.attachments)
		? (project.record.attachments as EventAttachment[])
		: [];
	const attachments = [...existing, ...uploaded];
	const posterUrl =
		(typeof project.record.posterUrl === 'string' && project.record.posterUrl) ||
		uploaded[0]?.url ||
		'';
	const syncedAt = new Date().toISOString();
	await projects.upsert({
		...project,
		record: { ...project.record, attachments, posterUrl },
		syncedAt
	});

	return json({
		attachments,
		posterUrl,
		syncedAt,
		mondayConfirmed: true,
		message: `${uploaded.length} ${uploaded.length === 1 ? 'photo' : 'photos'} uploaded and confirmed by Monday.`
	});
};
