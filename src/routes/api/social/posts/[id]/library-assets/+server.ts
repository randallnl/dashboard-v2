import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import { SocialAssetLibraryRepository, SocialPostRepository } from '$lib/server/db';
import { parseLibraryAssetIds } from '$lib/server/social/post-input';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	if (!params.id) error(400, 'Post ID is required.');
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const assetIds = parseLibraryAssetIds(body?.assetIds);
	if (!assetIds?.length) error(400, 'Select at least one library asset.');
	const postRepository = new SocialPostRepository(env!.DB);
	const post = await postRepository.find(params.id);
	if (!post) error(404, 'Social post not found.');
	const libraryAssets = await new SocialAssetLibraryRepository(env!.DB).findMany(assetIds);
	if (libraryAssets.length !== assetIds.length) {
		error(404, 'One or more selected library assets could not be found.');
	}
	const existingKeys = new Set(
		post.assets.filter((asset) => asset.storage === 'r2').map((asset) => asset.objectKey)
	);
	await postRepository.addAssets(
		post.id,
		libraryAssets
			.filter((asset) => !existingKeys.has(asset.objectKey))
			.map((asset) => ({
				storage: 'r2' as const,
				objectKey: asset.objectKey,
				sourceUrl: '',
				filename: asset.filename,
				contentType: asset.contentType,
				byteSize: asset.byteSize
			})),
		new Date().toISOString()
	);
	return json({
		post: await postRepository.find(post.id),
		message: 'Library media added to this post.'
	});
};
