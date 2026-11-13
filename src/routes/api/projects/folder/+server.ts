import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import { CommentRepository, ProjectDriveRepository, ProjectEventRepository } from '$lib/server/db';
import { recordProjectDriveUploadActivity } from '$lib/server/project-drive/activity';
import type { ProjectDriveFile } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type DriveFolderFile = {
	id: string;
	name: string;
	mimeType: string;
	url: string;
	byteSize: number;
	createdAt: string;
};

type DriveFolderResponse = {
	folder: { id: string; name: string; url: string };
	files: DriveFolderFile[];
	message?: string;
};

function projectIdFrom(form: FormData): string {
	const value = form.get('projectId');
	const projectId = typeof value === 'string' ? value.trim() : '';
	if (!/^\d+$/u.test(projectId)) error(400, 'Choose a valid project.');
	return projectId;
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const form = await request.formData();
	const projectId = projectIdFrom(form);
	const project = await new ProjectEventRepository(env!.DB).findById('project', projectId);
	if (!project) error(404, 'Project not found.');

	const driveRepository = new ProjectDriveRepository(env!.DB);
	const knownFolder = await driveRepository.findFolder('project', projectId);
	const knownFiles = await driveRepository.listFiles('project', projectId);
	const driveForm = new FormData();
	driveForm.set('projectId', projectId);
	driveForm.set('projectTitle', project.title);
	if (knownFolder?.folderId) driveForm.set('folderId', knownFolder.folderId);
	const driveResponse = await env!.FINANCE_DRIVE.fetch(
		new Request('https://finance-drive.internal/project-folder', {
			method: 'POST',
			body: driveForm
		})
	);
	const drivePayload = (await driveResponse.json().catch(() => null)) as DriveFolderResponse | null;
	if (!driveResponse.ok || !drivePayload?.folder?.id || !Array.isArray(drivePayload.files)) {
		error(502, drivePayload?.message || 'The project Drive folder could not be prepared.');
	}

	const now = new Date().toISOString();
	await driveRepository.recordFolder({
		source: 'project',
		projectId,
		folder: { folderId: drivePayload.folder.id, folderName: drivePayload.folder.name },
		now
	});
	await driveRepository.replaceFiles({
		source: 'project',
		projectId,
		folderId: drivePayload.folder.id,
		files: drivePayload.files.map((file) => ({
			...file,
			uploadedAt: file.createdAt || now
		})) satisfies Array<
			Pick<ProjectDriveFile, 'id' | 'name' | 'mimeType' | 'url' | 'byteSize' | 'uploadedAt'>
		>,
		now
	});
	const knownFileIds = new Set(knownFiles.map((file) => file.id));
	const newlyObservedFiles = drivePayload.files.filter((file) => !knownFileIds.has(file.id));
	for (let offset = 0; offset < newlyObservedFiles.length; offset += 10) {
		await recordProjectDriveUploadActivity(new CommentRepository(env!.DB), {
			source: 'project',
			projectId,
			files: newlyObservedFiles.slice(offset, offset + 10),
			origin: 'drive',
			now
		});
	}

	return json({
		folder: {
			source: 'project',
			projectId,
			folderId: drivePayload.folder.id,
			folderName: drivePayload.folder.name,
			createdAt: knownFolder?.createdAt || now,
			updatedAt: now,
			url: drivePayload.folder.url
		},
		files: await driveRepository.listFiles('project', projectId),
		message: drivePayload.files.length
			? `${drivePayload.files.length} ${drivePayload.files.length === 1 ? 'item is' : 'items are'} shown from the project Drive folder.`
			: 'Project Drive folder is ready. Open it to create a Google Doc.'
	});
};
