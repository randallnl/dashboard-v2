import { requireProjectManager, loadMemberContext } from '$lib/server/auth/member-context';
import {
	ProjectEventRepository,
	SocialAssetLibraryRepository,
	SocialPostRepository
} from '$lib/server/db';
import { socialDraftFromProject } from '$lib/social/project-draft';
import type { ProjectEventSource } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import {
	parseProjectAssetUrls,
	parseProjectReference,
	parseLibraryAssetIds,
	parseSocialPostInput
} from '$lib/server/social/post-input';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const posts = await new SocialPostRepository(env!.DB).list();
	return json({ posts }, { headers: { 'cache-control': 'private, no-store' } });
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const input = parseSocialPostInput(body);
	const reference = parseProjectReference(body?.project);
	const selectedProjectAssetUrls = parseProjectAssetUrls(body?.projectAssetUrls);
	const selectedLibraryAssetIds = parseLibraryAssetIds(body?.libraryAssetIds);
	let sourceAssets: ReturnType<typeof socialDraftFromProject>['assets'] = [];
	if (reference) {
		if (reference.source === 'community' && !context.viewerCapabilities.isAdmin) {
			error(403, 'Administrator access is required for community event content.');
		}
		const record = await new ProjectEventRepository(env!.DB).findById(
			reference.source as ProjectEventSource,
			reference.id
		);
		if (!record) error(404, 'The linked project could not be found.');
		const availableAssets = socialDraftFromProject(record).assets;
		sourceAssets = selectedProjectAssetUrls
			? availableAssets.filter((asset) => selectedProjectAssetUrls.includes(asset.sourceUrl))
			: availableAssets;
	}
	const libraryAssets = selectedLibraryAssetIds
		? await new SocialAssetLibraryRepository(env!.DB).findMany(selectedLibraryAssetIds)
		: [];
	if (selectedLibraryAssetIds && libraryAssets.length !== selectedLibraryAssetIds.length) {
		error(404, 'One or more selected library assets could not be found.');
	}
	const now = new Date().toISOString();
	const repository = new SocialPostRepository(env!.DB);
	const post = await repository.create(
		{
			id: crypto.randomUUID(),
			title: input.title,
			copy: input.copy,
			status: input.status,
			scheduledAt: input.scheduledAt,
			projectSource: reference?.source ?? '',
			projectId: reference?.id ?? '',
			createdByMemberId: context.viewer.id,
			channels: input.channels,
			assets: [
				...sourceAssets.map((asset) => ({ ...asset, objectKey: '' })),
				...libraryAssets.map((asset) => ({
					storage: 'r2' as const,
					objectKey: asset.objectKey,
					sourceUrl: '',
					filename: asset.filename,
					contentType: asset.contentType,
					byteSize: asset.byteSize
				}))
			]
		},
		now
	);
	const reviewedPost =
		input.status === 'review'
			? await repository.addReview(
					post.id,
					{ action: 'submitted', note: '', memberId: context.viewer.id },
					now
				)
			: post;
	return json({ post: reviewedPost ?? post, message: 'Social post saved.' }, { status: 201 });
};
