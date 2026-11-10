import type { ProjectDriveFile, ProjectDriveFolder, ProjectEventSource } from '$lib/types/domain';
import type { Database } from './types';

type ProjectDriveFolderRow = {
	source: ProjectEventSource;
	project_id: string;
	folder_id: string;
	folder_name: string;
	created_at: string;
	updated_at: string;
};

type ProjectDriveFileRow = {
	id: string;
	source: ProjectEventSource;
	project_id: string;
	folder_id: string;
	name: string;
	mime_type: string;
	web_view_url: string;
	byte_size: number;
	uploaded_by_member_id: string;
	uploaded_at: string;
};

function folderFromRow(row: ProjectDriveFolderRow): ProjectDriveFolder {
	return {
		source: row.source,
		projectId: row.project_id,
		folderId: row.folder_id,
		folderName: row.folder_name,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function fileFromRow(row: ProjectDriveFileRow): ProjectDriveFile {
	return {
		id: row.id,
		source: row.source,
		projectId: row.project_id,
		folderId: row.folder_id,
		name: row.name,
		mimeType: row.mime_type,
		url: row.web_view_url,
		byteSize: Number(row.byte_size) || 0,
		uploadedByMemberId: row.uploaded_by_member_id,
		uploadedAt: row.uploaded_at
	};
}

export class ProjectDriveRepository {
	constructor(private readonly db: Database) {}

	async recordFolder(input: {
		source: ProjectEventSource;
		projectId: string;
		folder: Pick<ProjectDriveFolder, 'folderId' | 'folderName'>;
		now: string;
	}): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO project_drive_folders (
					source, project_id, folder_id, folder_name, created_at, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
				ON CONFLICT(source, project_id) DO UPDATE SET
					folder_id = excluded.folder_id,
					folder_name = excluded.folder_name,
					updated_at = excluded.updated_at`
			)
			.bind(input.source, input.projectId, input.folder.folderId, input.folder.folderName, input.now)
			.run();
	}

	async findFolder(
		source: ProjectEventSource,
		projectId: string
	): Promise<ProjectDriveFolder | null> {
		const row = await this.db
			.prepare(
				`SELECT source, project_id, folder_id, folder_name, created_at, updated_at
				 FROM project_drive_folders
				 WHERE source = ?1 AND project_id = ?2`
			)
			.bind(source, projectId)
			.first<ProjectDriveFolderRow>();
		return row ? folderFromRow(row) : null;
	}

	async listFiles(source: ProjectEventSource, projectId: string): Promise<ProjectDriveFile[]> {
		const result = await this.db
			.prepare(
				`SELECT id, source, project_id, folder_id, name, mime_type, web_view_url,
					byte_size, uploaded_by_member_id, uploaded_at
				 FROM project_drive_files
				 WHERE source = ?1 AND project_id = ?2
				 ORDER BY uploaded_at DESC, name COLLATE NOCASE`
			)
			.bind(source, projectId)
			.all<ProjectDriveFileRow>();
		return result.results.map(fileFromRow);
	}

	async replaceFiles(input: {
		source: ProjectEventSource;
		projectId: string;
		folderId: string;
		files: Array<Pick<ProjectDriveFile, 'id' | 'name' | 'mimeType' | 'url' | 'byteSize' | 'uploadedAt'>>;
		now: string;
	}): Promise<void> {
		await this.db
			.prepare(
				`DELETE FROM project_drive_files
				 WHERE source = ?1 AND project_id = ?2`
			)
			.bind(input.source, input.projectId)
			.run();

		for (let offset = 0; offset < input.files.length; offset += 75) {
			const statements = input.files.slice(offset, offset + 75).map((file) =>
				this.db
					.prepare(
						`INSERT INTO project_drive_files (
							id, source, project_id, folder_id, name, mime_type, web_view_url,
							byte_size, uploaded_by_member_id, uploaded_at
						) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '', ?9)`
					)
					.bind(
						file.id,
						input.source,
						input.projectId,
						input.folderId,
						file.name,
						file.mimeType,
						file.url,
						file.byteSize,
						file.uploadedAt || input.now
					)
			);
			await this.db.batch(statements);
		}
	}

	async recordUpload(input: {
		source: ProjectEventSource;
		projectId: string;
		folder: Pick<ProjectDriveFolder, 'folderId' | 'folderName'>;
		files: Array<Pick<ProjectDriveFile, 'id' | 'name' | 'mimeType' | 'url' | 'byteSize'>>;
		uploadedByMemberId: string;
		now: string;
	}): Promise<void> {
		const statements = [
			this.db
				.prepare(
					`INSERT INTO project_drive_folders (
						source, project_id, folder_id, folder_name, created_at, updated_at
					) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
					ON CONFLICT(source, project_id) DO UPDATE SET
						folder_id = excluded.folder_id,
						folder_name = excluded.folder_name,
						updated_at = excluded.updated_at`
				)
				.bind(
					input.source,
					input.projectId,
					input.folder.folderId,
					input.folder.folderName,
					input.now
				),
			...input.files.map((file) =>
				this.db
					.prepare(
						`INSERT INTO project_drive_files (
							id, source, project_id, folder_id, name, mime_type, web_view_url,
							byte_size, uploaded_by_member_id, uploaded_at
						) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
						ON CONFLICT(id) DO UPDATE SET
							folder_id = excluded.folder_id,
							name = excluded.name,
							mime_type = excluded.mime_type,
							web_view_url = excluded.web_view_url,
							byte_size = excluded.byte_size,
							uploaded_by_member_id = excluded.uploaded_by_member_id,
							uploaded_at = excluded.uploaded_at`
					)
					.bind(
						file.id,
						input.source,
						input.projectId,
						input.folder.folderId,
						file.name,
						file.mimeType,
						file.url,
						file.byteSize,
						input.uploadedByMemberId,
						input.now
					)
			)
		];
		await this.db.batch(statements);
	}
}
