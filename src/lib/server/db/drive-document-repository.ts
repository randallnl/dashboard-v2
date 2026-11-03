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
		syncedAt: row.synced_at
	};
}

export class DriveDocumentRepository {
	constructor(private readonly db: Database) {}

	async list(allowed: DriveDocumentVisibility[]): Promise<DriveDocument[]> {
		if (!allowed.length) return [];
		const placeholders = allowed.map(() => '?').join(', ');
		const result = await this.db
			.prepare(
				`SELECT * FROM drive_documents WHERE visibility IN (${placeholders}) ORDER BY is_folder DESC, name COLLATE NOCASE`
			)
			.bind(...allowed)
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
}
