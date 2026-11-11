import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexFolderTree } from './drive-sync-worker';
import { OPERATIONS_DOCUMENT_ROOT } from './lib/drive-libraries';

const folder = 'application/vnd.google-apps.folder';
afterEach(() => vi.unstubAllGlobals());

describe('Drive library indexing', () => {
	it('keeps every Operations section and descendant admin-only, including numbered public-looking folders', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					files: [
						{ id: 'start', name: '00 — Start Here', mimeType: folder },
						{ id: 'finance', name: '03 — Finance', mimeType: folder }
					]
				})
			)
			.mockResolvedValueOnce(
				Response.json({ files: [{ id: 'guide', name: 'Guide', mimeType: 'application/pdf' }] })
			)
			.mockResolvedValueOnce(Response.json({ files: [], nextPageToken: 'next' }))
			.mockResolvedValueOnce(
				Response.json({ files: [{ id: 'budget', name: 'Budget', mimeType: 'application/pdf' }] })
			);
		vi.stubGlobal('fetch', fetchMock);
		const files = await indexFolderTree('token', OPERATIONS_DOCUMENT_ROOT, true);
		expect(files).toHaveLength(4);
		expect(
			files.every(
				(file) => file.visibility === 'admin' && file.libraryRootId === OPERATIONS_DOCUMENT_ROOT
			)
		).toBe(true);
		expect(files.find((file) => file.id === 'budget')?.parentId).toBe('finance');
		expect(String(fetchMock.mock.calls[3][0])).toContain('pageToken=next');
	});
	it('preserves CoLab member and colab visibility rules', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(
					Response.json({
						files: [
							{ id: 'start', name: '00 — Start Here', mimeType: folder },
							{ id: 'retail', name: '01 — Retail', mimeType: folder }
						]
					})
				)
				.mockResolvedValueOnce(Response.json({ files: [] }))
				.mockResolvedValueOnce(Response.json({ files: [] }))
		);
		const files = await indexFolderTree('token', 'colab-root');
		expect(files.map((file) => file.visibility)).toEqual(['member', 'colab']);
	});
});
