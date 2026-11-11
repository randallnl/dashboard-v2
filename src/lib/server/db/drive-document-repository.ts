import { COLAB_DOCUMENT_ROOT } from '$lib/drive-libraries';
import type { DriveDocument, DriveDocumentVisibility, DriveSyncState } from '$lib/types/drive';
import type { Database } from './types';

type DriveDocumentRow = {
	id: string;
	parent_id: string;
	root_section_id: string;
	name: string;
	mime_type: string;
	web_view_url: string;
	created_at: string;
	modified_at: string;
	byte_size: number;
	is_folder: number;
	is_shortcut: number;
	shortcut_target_id: string;
	visibility: DriveDocumentVisibility;
	synced_at: string;
	category: string;
	summary: string;
	keywords: string;
	is_featured: number;
};

function mapDocument(row: DriveDocumentRow): DriveDocument {
	return {
		id: row.id,
		parentId: row.parent_id,
		rootSectionId: row.root_section_id,
		name: row.name,
		mimeType: row.mime_type,
		webViewUrl: row.web_view_url,
		createdAt: row.created_at,
		modifiedAt: row.modified_at,
		byteSize: row.byte_size,
		isFolder: row.is_folder === 1,
		isShortcut: row.is_shortcut === 1,
		shortcutTargetId: row.shortcut_target_id,
		visibility: row.visibility,
		syncedAt: row.synced_at,
		category: row.category,
		summary: row.summary,
		keywords: row.keywords,
		isFeatured: row.is_featured === 1
	};
}

export class DriveDocumentRepository {
	constructor(
		private readonly db: Database,
		private readonly libraryRootId: string = COLAB_DOCUMENT_ROOT
	) {}

	async list(allowed: DriveDocumentVisibility[]): Promise<DriveDocument[]> {
		if (!allowed.length) return [];
		const placeholders = allowed.map(() => '?').join(', ');
		const result = await this.db
			.prepare(
				`SELECT document.*,
					COALESCE(annotation.category, '') AS category,
					COALESCE(annotation.summary, '') AS summary,
					COALESCE(annotation.keywords, '') AS keywords,
					COALESCE(annotation.is_featured, 0) AS is_featured
				 FROM drive_documents document
				 LEFT JOIN drive_document_annotations annotation ON annotation.document_id = document.id
				 WHERE document.library_root_id = ? AND document.visibility IN (${placeholders})
				 ORDER BY document.is_folder DESC, document.name COLLATE NOCASE`
			)
			.bind(this.libraryRootId, ...allowed)
			.all<DriveDocumentRow>();
		return result.results.map(mapDocument);
	}

	async syncState(): Promise<DriveSyncState> {
		const row = await this.db
			.prepare(
				'SELECT status, started_at, completed_at, item_count, error_message FROM drive_sync_state WHERE id = 1'
			)
			.first<{
				status: DriveSyncState['status'];
				started_at: string;
				completed_at: string;
				item_count: number;
				error_message: string;
			}>();
		return {
			status: row?.status ?? 'pending',
			startedAt: row?.started_at ?? '',
			completedAt: row?.completed_at ?? '',
			itemCount: row?.item_count ?? 0,
			errorMessage: row?.error_message ?? ''
		};
	}

	async personalization(memberId: string): Promise<{
		favoriteIds: string[];
		recentlyViewedIds: string[];
	}> {
		const result = await this.db
			.prepare(
				`SELECT interaction.document_id, interaction.is_favorite, interaction.last_viewed_at
				 FROM drive_document_interactions interaction
				 INNER JOIN drive_documents document ON document.id = interaction.document_id
				 WHERE interaction.member_id = ? AND document.library_root_id = ?
				 ORDER BY interaction.last_viewed_at DESC`
			)
			.bind(memberId, this.libraryRootId)
			.all<{ document_id: string; is_favorite: number; last_viewed_at: string }>();
		return {
			favoriteIds: result.results
				.filter((row) => row.is_favorite === 1)
				.map((row) => row.document_id),
			recentlyViewedIds: result.results
				.filter((row) => row.last_viewed_at)
				.slice(0, 8)
				.map((row) => row.document_id)
		};
	}

	async isVisible(documentId: string, allowed: DriveDocumentVisibility[]): Promise<boolean> {
		if (!allowed.length) return false;
		const placeholders = allowed.map(() => '?').join(', ');
		const row = await this.db
			.prepare(
				`SELECT id FROM drive_documents WHERE id = ? AND library_root_id = ? AND is_folder = 0 AND visibility IN (${placeholders})`
			)
			.bind(documentId, this.libraryRootId, ...allowed)
			.first<{ id: string }>();
		return Boolean(row);
	}

	async setFavorite(memberId: string, documentId: string, favorite: boolean, now: string) {
		await this.db
			.prepare(
				`INSERT INTO drive_document_interactions
					(member_id, document_id, is_favorite, favorited_at)
				 VALUES (?, ?, ?, ?)
				 ON CONFLICT(member_id, document_id) DO UPDATE SET
					is_favorite = excluded.is_favorite,
					favorited_at = excluded.favorited_at`
			)
			.bind(memberId, documentId, favorite ? 1 : 0, favorite ? now : '')
			.run();
	}

	async recordView(memberId: string, documentId: string, now: string) {
		await this.db
			.prepare(
				`INSERT INTO drive_document_interactions
					(member_id, document_id, last_viewed_at, view_count)
				 VALUES (?, ?, ?, 1)
				 ON CONFLICT(member_id, document_id) DO UPDATE SET
					last_viewed_at = excluded.last_viewed_at,
					view_count = drive_document_interactions.view_count + 1`
			)
			.bind(memberId, documentId, now)
			.run();
	}

	async saveAnnotation(input: {
		documentId: string;
		category: string;
		summary: string;
		keywords: string;
		featured: boolean;
		updatedBy: string;
		now: string;
	}) {
		await this.db
			.prepare(
				`INSERT INTO drive_document_annotations
					(document_id, category, summary, keywords, is_featured, featured_at, updated_at, updated_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(document_id) DO UPDATE SET
					category = excluded.category,
					summary = excluded.summary,
					keywords = excluded.keywords,
					is_featured = excluded.is_featured,
					featured_at = CASE
						WHEN excluded.is_featured = 1 AND drive_document_annotations.is_featured = 0
						THEN excluded.featured_at
						ELSE drive_document_annotations.featured_at
					END,
					updated_at = excluded.updated_at,
					updated_by = excluded.updated_by`
			)
			.bind(
				input.documentId,
				input.category,
				input.summary,
				input.keywords,
				input.featured ? 1 : 0,
				input.featured ? input.now : '',
				input.now,
				input.updatedBy
			)
			.run();
	}
}
