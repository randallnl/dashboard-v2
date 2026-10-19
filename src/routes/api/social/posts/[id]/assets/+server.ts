import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import { SocialPostRepository } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ACCEPTED_MEDIA_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'video/mp4',
	'video/quicktime'
]);
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	if (!params.id) error(400, 'Post ID is required.');
	const repository = new SocialPostRepository(env!.DB);
	if (!(await repository.find(params.id))) error(404, 'Social post not found.');
	const form = await request.formData();
	const file = form.get('asset');
	if (!(file instanceof File)) error(400, 'Choose a media file to upload.');
	if (!ACCEPTED_MEDIA_TYPES.has(file.type)) {
		error(400, 'Upload a JPG, PNG, GIF, WebP, MP4, or MOV file.');
	}
	if (!file.size || file.size > MAX_MEDIA_BYTES)
		error(400, 'Media files must be 20 MB or smaller.');
	const assetId = crypto.randomUUID();
	const extension =
		file.name
			.split('.')
			.pop()
			?.replace(/[^a-z0-9]/giu, '')
			.slice(0, 10) || 'bin';
	const objectKey = `social/${params.id}/${assetId}.${extension}`;
	const media = await file.arrayBuffer();
	await env!.SOCIAL_MEDIA_ASSETS.put(objectKey, media, {
		httpMetadata: { contentType: file.type },
		customMetadata: { originalFilename: file.name, uploadedBy: context.viewer.id }
	});
	await repository.addAssets(
		params.id,
		[
			{
				storage: 'r2',
				objectKey,
				sourceUrl: '',
				filename: file.name.slice(0, 255),
				contentType: file.type,
				byteSize: file.size
			}
		],
		new Date().toISOString()
	);
	const post = await repository.find(params.id);
	return json({ post, message: 'Media added to this post.' }, { status: 201 });
};
