import { COLAB_DOCUMENT_ROOT, OPERATIONS_DOCUMENT_ROOT } from '$lib/drive-libraries';
import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { DriveDocumentRepository } from '$lib/server/db';
import type { DriveDocumentVisibility } from '$lib/types/drive';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function libraryRoot(url: URL, context: Awaited<ReturnType<typeof loadMemberContext>>) {
	const library = url.searchParams.get('library');
	if (library && library !== 'colab' && library !== 'operations') error(400, 'Invalid library');
	if (library === 'operations') {
		requireAdmin(context);
		requireWritableMemberView(context);
		return OPERATIONS_DOCUMENT_ROOT;
	}
	return COLAB_DOCUMENT_ROOT;
}

function allowedVisibility(context: Awaited<ReturnType<typeof loadMemberContext>>) {
	const allowed: DriveDocumentVisibility[] = ['member'];
	if (!context.capabilities.isRetailOnly) allowed.push('colab');
	if (context.viewerCapabilities.isAdmin && !context.isViewingAs) allowed.push('admin');
	return allowed;
}

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const allowed = allowedVisibility(context);
	const rootFolderId = libraryRoot(url, context);
	const repository = new DriveDocumentRepository(env!.DB, rootFolderId);
	const [documents, sync, personalization] = await Promise.all([
		repository.list(allowed),
		repository.syncState(),
		repository.personalization(context.member.id)
	]);
	return json({
		rootFolderId,
		documents,
		sync,
		canCurate: context.viewerCapabilities.isAdmin && !context.isViewingAs,
		...personalization
	});
};

export const POST: RequestHandler = async ({ locals, platform, request, url }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	const body = (await request.json().catch(() => null)) as {
		action?: string;
		documentId?: string;
		favorite?: boolean;
		category?: string;
		summary?: string;
		keywords?: string;
		featured?: boolean;
	} | null;
	const documentId = body?.documentId?.trim() ?? '';
	if (!documentId) error(400, 'Document required');
	if (body?.action !== 'favorite' && body?.action !== 'view' && body?.action !== 'annotate')
		error(400, 'Invalid action');
	const rootFolderId = libraryRoot(url, context);
	const repository = new DriveDocumentRepository(env!.DB, rootFolderId);
	if (!(await repository.isVisible(documentId, allowedVisibility(context))))
		error(404, 'Document not found');
	const now = new Date().toISOString();
	if (body.action === 'annotate') {
		requireAdmin(context);
		const category = body.category?.trim().slice(0, 60) ?? '';
		const summary = body.summary?.trim().slice(0, 500) ?? '';
		const keywords = body.keywords?.trim().slice(0, 300) ?? '';
		if (typeof body.featured !== 'boolean') error(400, 'Featured state required');
		await repository.saveAnnotation({
			documentId,
			category,
			summary,
			keywords,
			featured: body.featured,
			updatedBy: context.viewer.id,
			now
		});
	} else if (body.action === 'favorite') {
		if (typeof body.favorite !== 'boolean') error(400, 'Favorite state required');
		await repository.setFavorite(context.member.id, documentId, body.favorite, now);
	} else {
		await repository.recordView(context.member.id, documentId, now);
	}
	return json({ ok: true });
};
