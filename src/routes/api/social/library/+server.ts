import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import { SocialAssetLibraryRepository } from '$lib/server/db';
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

function text(value: FormDataEntryValue | null, maxLength: number): string {
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function tags(value: FormDataEntryValue | null): string[] {
	return [
		...new Set(
			text(value, 1000)
				.split(',')
				.map((tag) => tag.trim().replace(/\s+/gu, ' ').slice(0, 48))
				.filter(Boolean)
		)
	].slice(0, 20);
}

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const assets = await new SocialAssetLibraryRepository(env!.DB).list();
	return json({ assets }, { headers: { 'cache-control': 'private, no-store' } });
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const form = await request.formData();
	const file = form.get('asset');
	if (!(file instanceof File)) error(400, 'Choose a media file to add to the library.');
	if (!ACCEPTED_MEDIA_TYPES.has(file.type)) {
		error(400, 'Upload a JPG, PNG, GIF, WebP, MP4, or MOV file.');
	}
	if (!file.size || file.size > MAX_MEDIA_BYTES) {
		error(400, 'Library media files must be 20 MB or smaller.');
	}
	const assetId = crypto.randomUUID();
	const extension =
		file.name
			.split('.')
			.pop()
			?.replace(/[^a-z0-9]/giu, '')
			.slice(0, 10) || 'bin';
	const objectKey = `library/${assetId}.${extension}`;
	const media = await file.arrayBuffer();
	await env!.SOCIAL_MEDIA_ASSETS.put(objectKey, media, {
		httpMetadata: { contentType: file.type },
		customMetadata: { originalFilename: file.name, uploadedBy: context.viewer.id }
	});
	const asset = await new SocialAssetLibraryRepository(env!.DB).create(
		{
			id: assetId,
			objectKey,
			filename: file.name.slice(0, 255),
			contentType: file.type,
			byteSize: file.size,
			altText: text(form.get('altText'), 1000),
			tags: tags(form.get('tags')),
			credit: text(form.get('credit'), 500),
			createdByMemberId: context.viewer.id
		},
		new Date().toISOString()
	);
	return json({ asset, message: 'Asset added to the shared library.' }, { status: 201 });
};
