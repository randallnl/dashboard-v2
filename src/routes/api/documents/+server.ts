import { loadMemberContext } from '$lib/server/auth/member-context';
import { DriveDocumentRepository } from '$lib/server/db';
import type { DriveDocumentVisibility } from '$lib/types/drive';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ROOT_FOLDER_ID = '1wEEDbh0PmGiPkdS6S_LfLZeIcQtOSIEm';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const allowed: DriveDocumentVisibility[] = ['member'];
	if (!context.capabilities.isRetailOnly) allowed.push('colab');
	if (context.viewerCapabilities.isAdmin && !context.isViewingAs) allowed.push('admin');
	const repository = new DriveDocumentRepository(env!.DB);
	const [documents, sync] = await Promise.all([repository.list(allowed), repository.syncState()]);
	return json({ rootFolderId: ROOT_FOLDER_ID, documents, sync });
};
