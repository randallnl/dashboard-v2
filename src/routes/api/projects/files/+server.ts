import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import { CommentRepository, ProjectDriveRepository, ProjectEventRepository } from '$lib/server/db';
import { recordProjectDriveUploadActivity } from '$lib/server/project-drive/activity';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_FILES = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

type DriveUpload = {
	id: string;
	name: string;
	mimeType: string;
	url: string;
	byteSize: number;
};

type DriveUploadResponse = {
	folder: { id: string; name: string; url: string };
	files: DriveUpload[];
	message?: string;
};

function projectIdFrom(form: FormData): string {
	const value = form.get('projectId');
	const projectId = typeof value === 'string' ? value.trim() : '';
	if (!/^\d+$/u.test(projectId)) error(400, 'Choose a valid project.');
	return projectId;
}

function uploadedFiles(form: FormData): File[] {
	const files = form.getAll('files').filter((value): value is File => value instanceof File);
	if (!files.length || files.length > MAX_FILES) {
		error(400, `Choose between 1 and ${MAX_FILES} files.`);
	}
	for (const file of files) {
		if (!file.size) error(400, `${file.name || 'That file'} is empty.`);
		if (file.size > MAX_FILE_BYTES) {
			error(413, `${file.name} must be 25 MB or smaller.`);
		}
	}
	return files;
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const form = await request.formData();
	const projectId = projectIdFrom(form);
	const files = uploadedFiles(form);
	const project = await new ProjectEventRepository(env!.DB).findById('project', projectId);
	if (!project) error(404, 'Project not found.');

	const driveRepository = new ProjectDriveRepository(env!.DB);
	const knownFolder = await driveRepository.findFolder('project', projectId);
	const driveForm = new FormData();
	driveForm.set('projectId', projectId);
	driveForm.set('projectTitle', project.title);
	if (knownFolder?.folderId) driveForm.set('folderId', knownFolder.folderId);
	for (const file of files) driveForm.append('files', file, file.name);

	const driveResponse = await env!.FINANCE_DRIVE.fetch(
		new Request('https://finance-drive.internal/project-files', {
			method: 'POST',
			body: driveForm
		})
	);
	const drivePayload = (await driveResponse.json().catch(() => null)) as DriveUploadResponse & {
		message?: string;
	};
	if (!driveResponse.ok || !drivePayload?.folder?.id || !Array.isArray(drivePayload.files)) {
		error(502, drivePayload?.message || 'The project Drive folder could not accept those files.');
	}

	const now = new Date().toISOString();
	await driveRepository.recordUpload({
		source: 'project',
		projectId,
		folder: { folderId: drivePayload.folder.id, folderName: drivePayload.folder.name },
		files: drivePayload.files,
		uploadedByMemberId: context.viewer.id,
		now
	});
	await recordProjectDriveUploadActivity(new CommentRepository(env!.DB), {
		source: 'project',
		projectId,
		files: drivePayload.files,
		origin: 'dashboard',
		actor: context.viewer.preferredName,
		now
	});

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
		message: `${drivePayload.files.length} ${drivePayload.files.length === 1 ? 'file was' : 'files were'} saved to the project Drive folder.`
	});
};
