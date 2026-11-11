import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COLAB_DOCUMENT_ROOT, OPERATIONS_DOCUMENT_ROOT } from '$lib/drive-libraries';

const state = vi.hoisted(() => ({ admin: false, viewingAs: false, roots: [] as string[] }));
vi.mock('$lib/server/auth/member-context', async () => {
	const { error } = await import('@sveltejs/kit');
	return {
		loadMemberContext: async () => ({
			member: { id: 'member' },
			viewer: { id: 'member' },
			capabilities: { isRetailOnly: false },
			viewerCapabilities: { isAdmin: state.admin },
			isViewingAs: state.viewingAs
		}),
		requireAdmin: () => {
			if (!state.admin) error(403, 'Administrator access required');
		},
		requireWritableMemberView: () => {
			if (state.viewingAs) error(403, 'Viewing as another member');
		}
	};
});
vi.mock('$lib/server/db', () => ({
	DriveDocumentRepository: class {
		constructor(_db: unknown, root: string) {
			state.roots.push(root);
		}
		async list() {
			return [];
		}
		async syncState() {
			return { status: 'complete' };
		}
		async personalization() {
			return { favoriteIds: [], recentlyViewedIds: [] };
		}
		async isVisible() {
			return false;
		}
	}
}));
import { GET, POST } from './+server';
function event(library: string) {
	return {
		locals: {},
		platform: { env: { DB: {} } },
		url: new URL(`https://example.com/api/documents${library ? `?library=${library}` : ''}`),
		request: new Request('https://example.com/api/documents', {
			method: 'POST',
			body: JSON.stringify({ action: 'favorite', documentId: 'other-library-id', favorite: true })
		})
	} as Parameters<typeof GET>[0];
}
beforeEach(() => {
	state.admin = false;
	state.viewingAs = false;
	state.roots = [];
});
describe('document library access', () => {
	it('denies Operations reads to ordinary members', async () => {
		await expect(GET(event('operations'))).rejects.toMatchObject({ status: 403 });
		expect(state.roots).toEqual([]);
	});
	it('denies Operations reads while impersonating a member', async () => {
		state.admin = true;
		state.viewingAs = true;
		await expect(GET(event('operations'))).rejects.toMatchObject({ status: 403 });
	});
	it('selects the Operations root for admins and defaults existing requests to CoLab', async () => {
		state.admin = true;
		expect(await (await GET(event('operations'))).json()).toMatchObject({
			rootFolderId: OPERATIONS_DOCUMENT_ROOT
		});
		expect(await (await GET(event(''))).json()).toMatchObject({
			rootFolderId: COLAB_DOCUMENT_ROOT
		});
		expect(state.roots).toEqual([OPERATIONS_DOCUMENT_ROOT, COLAB_DOCUMENT_ROOT]);
	});
	it('rejects writes for files outside the selected library', async () => {
		state.admin = true;
		await expect(POST(event('operations'))).rejects.toMatchObject({ status: 404 });
	});
});
