import type { ProjectDriveFile, ProjectEventSource } from '$lib/types/domain';
import { CommentRepository } from '$lib/server/db/comment-repository';

type DriveUploadOrigin = 'dashboard' | 'email' | 'drive';
type DriveUploadKind = 'files' | 'shortcuts';
type LinkedDriveFile = Pick<ProjectDriveFile, 'id' | 'name' | 'url'>;

function description(
	origin: DriveUploadOrigin,
	count: number,
	actor: string,
	kind: DriveUploadKind
): string {
	const files = `${count} ${
		kind === 'shortcuts'
			? count === 1
				? 'Drive shortcut was'
				: 'Drive shortcuts were'
			: count === 1
				? 'file was'
				: 'files were'
	}`;
	if (origin === 'email') {
		return `${files} saved to the project Drive folder from an email${
			actor ? ` sent by ${actor}` : ''
		}.`;
	}
	if (origin === 'dashboard') {
		return `${files} added to the project Drive folder${actor ? ` by ${actor}` : ''}.`;
	}
	return `${files} added directly to the project Drive folder.`;
}

function safeFileName(name: string): string {
	return name.replaceAll(/[\r\n]+/gu, ' ').trim() || 'Untitled file';
}

export function projectDriveUploadActivity(input: {
	source: ProjectEventSource;
	projectId: string;
	files: LinkedDriveFile[];
	origin: DriveUploadOrigin;
	kind?: DriveUploadKind;
	actor?: string;
	now: string;
}) {
	const fileIds = [...new Set(input.files.map((file) => file.id).filter(Boolean))].sort();
	const kind = input.kind ?? 'files';
	return {
		id:
			kind === 'shortcuts'
				? `drive-upload:${input.origin}:shortcuts:${input.source}:${input.projectId}:${fileIds.join(':')}`
				: `drive-upload:${input.origin}:${input.source}:${input.projectId}:${fileIds.join(':')}`,
		source: input.source,
		eventId: input.projectId,
		memberId: `system:drive:${input.origin}`,
		authorLabel: 'Project Drive',
		body: [
				description(input.origin, input.files.length, input.actor?.trim() ?? '', kind),
			'',
			...input.files.flatMap((file) => [safeFileName(file.name), file.url])
		].join('\n'),
		mentionLabels: [],
		createdAt: input.now
	};
}

export async function recordProjectDriveUploadActivity(
	comments: Pick<CommentRepository, 'createIfAbsent'>,
	input: {
		source: ProjectEventSource;
		projectId: string;
		files: LinkedDriveFile[];
		origin: DriveUploadOrigin;
		kind?: DriveUploadKind;
		actor?: string;
		now: string;
	}
): Promise<boolean> {
	if (!input.files.length) return false;
	return comments.createIfAbsent(projectDriveUploadActivity(input));
}
