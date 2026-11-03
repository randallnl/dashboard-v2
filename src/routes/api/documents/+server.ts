import { loadMemberContext, requireWritableMemberView } from '$lib/server/auth/member-context';
import { DriveDocumentRepository } from '$lib/server/db';
import type { DriveDocumentVisibility } from '$lib/types/drive';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ROOT_FOLDER_ID = '1wEEDbh0PmGiPkdS6S_LfLZeIcQtOSIEm';

function allowedVisibility(context: Awaited<ReturnType<typeof loadMemberContext>>) {
	const allowed: DriveDocumentVisibility[] = ['member'];
	if (!context.capabilities.isRetailOnly) allowed.push('colab');
	if (context.viewerCapabilities.isAdmin && !context.isViewingAs) allowed.push('admin');
	return allowed;
}

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const allowed = allowedVisibility(context);
	const repository = new DriveDocumentRepository(env!.DB);
	const [documents, sync, personalization] = await Promise.all([
		repository.list(allowed),
		repository.syncState(),
		repository.personalization(context.member.id)
	]);
	return json({ rootFolderId: ROOT_FOLDER_ID, documents, sync, ...personalization });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	const body = (await request.json().catch(() => null)) as {
		action?: string;
		documentId?: string;
		favorite?: boolean;
	} | null;
	const documentId = body?.documentId?.trim() ?? '';
	if (!documentId) error(400, 'Document required');
	if (body?.action !== 'favorite' && body?.action !== 'view') error(400, 'Invalid action');
	const repository = new DriveDocumentRepository(env!.DB);
	if (!(await repository.isVisible(documentId, allowedVisibility(context))))
		error(404, 'Document not found');
	const now = new Date().toISOString();
	if (body.action === 'favorite') {
		if (typeof body.favorite !== 'boolean') error(400, 'Favorite state required');
		await repository.setFavorite(context.member.id, documentId, body.favorite, now);
	} else {
		await repository.recordView(context.member.id, documentId, now);
	}
	return json({ ok: true });
};
