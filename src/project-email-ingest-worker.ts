import PostalMime, { type Attachment } from 'postal-mime';
import { ProjectDriveRepository } from '$lib/server/db/project-drive-repository';
import { ProjectEventRepository } from '$lib/server/db/project-repository';

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_COMMENT_LENGTH = 2_000;
const MAX_ERROR_LENGTH = 500;

type IngestRow = {
	status: 'processing' | 'complete' | 'failed';
	comment_id: string;
	attachment_count: number;
};

type DriveFile = {
	id: string;
	name: string;
	mimeType: string;
	url: string;
	byteSize: number;
};

type DriveUploadResponse = {
	folder: { id: string; name: string };
	files: DriveFile[];
	message?: string;
};

function encodeBase64Url(value: ArrayBuffer): string {
	let binary = '';
	for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

async function digest(value: ArrayBuffer): Promise<string> {
	return encodeBase64Url(await crypto.subtle.digest('SHA-256', value));
}

function safeFilename(name: string | null, position: number): string {
	const cleaned = (name ?? '')
		.replaceAll(/[\\/:*?"<>|\p{Cc}]/gu, '_')
		.replaceAll(/\s+/gu, ' ')
		.trim()
		.slice(0, 180);
	return cleaned || `email-attachment-${position + 1}.bin`;
}

function safeMimeType(value: string): string {
	return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/iu.test(value)
		? value
		: 'application/octet-stream';
}

function ordinaryAttachments(attachments: Attachment[]): Attachment[] {
	return attachments.filter(
		(attachment) =>
			attachment.disposition === 'attachment' || Boolean(attachment.filename && !attachment.related)
	);
}

function inboxTokenFrom(message: ForwardableEmailMessage, inbox: string): string {
	const recipient = message.to.trim().toLocaleLowerCase('en-US');
	const configuredInbox = inbox.trim().toLocaleLowerCase('en-US');
	if (recipient !== configuredInbox) return '';
	const token =
		message.headers.get('subject')?.match(/\[project\s*:\s*([a-f0-9-]{16,})\]/iu)?.[1] ?? '';
	return /^[a-f0-9-]{16,}$/u.test(token) ? token : '';
}

function plainText(value: string): string {
	return value
		.replaceAll(/\r\n?/gu, '\n')
		.replaceAll(/\n{3,}/gu, '\n\n')
		.trim();
}

function emailComment(input: {
	sender: string;
	subject: string;
	text: string;
	attachmentCount: number;
}): string {
	const header = `Forwarded email\nFrom: ${input.sender}\nSubject: ${input.subject}\n\n`;
	const fallback = input.attachmentCount
		? `This email included ${input.attachmentCount} attachment${input.attachmentCount === 1 ? '' : 's'}.`
		: 'This email did not include a plain-text body.';
	return `${header}${plainText(input.text) || fallback}`.slice(0, MAX_COMMENT_LENGTH).trim();
}

async function uploadAttachments(input: {
	env: ProjectEmailEnv;
	projectId: string;
	projectTitle: string;
	attachments: Attachment[];
	knownFolderId: string;
}): Promise<DriveUploadResponse> {
	const form = new FormData();
	form.set('projectId', input.projectId);
	form.set('projectTitle', input.projectTitle);
	if (input.knownFolderId) form.set('folderId', input.knownFolderId);
	for (const [position, attachment] of input.attachments.entries()) {
		if (!(attachment.content instanceof ArrayBuffer)) {
			throw new Error('An email attachment could not be decoded as a file');
		}
		const filename = safeFilename(attachment.filename, position);
		form.append(
			'files',
			new File([attachment.content], filename, { type: safeMimeType(attachment.mimeType) })
		);
	}
	const response = await input.env.PROJECT_DRIVE.fetch(
		new Request('https://finance-drive.internal/project-files', { method: 'POST', body: form })
	);
	const payload = (await response.json().catch(() => null)) as DriveUploadResponse | null;
	if (!response.ok || !payload?.folder?.id || !Array.isArray(payload.files)) {
		throw new Error(
			payload?.message || 'The project Drive folder could not accept the attachments'
		);
	}
	return payload;
}

async function processProjectEmail(
	message: ForwardableEmailMessage,
	env: ProjectEmailEnv
): Promise<void> {
	const inboxToken = inboxTokenFrom(message, env.PROJECT_INBOX_EMAIL);
	if (!inboxToken) {
		message.setReject(
			'Use the project forwarding address and subject tag shown in the CoLab dashboard.'
		);
		return;
	}

	const raw = await new Response(message.raw).arrayBuffer();
	const parsed = await PostalMime.parse(raw, { attachmentEncoding: 'arraybuffer' });
	const attachments = ordinaryAttachments(parsed.attachments);
	if (attachments.length > MAX_ATTACHMENTS) {
		message.setReject(`This inbox accepts up to ${MAX_ATTACHMENTS} attachments at a time.`);
		return;
	}
	for (const attachment of attachments) {
		if (
			!(attachment.content instanceof ArrayBuffer) ||
			attachment.content.byteLength > MAX_ATTACHMENT_BYTES
		) {
			message.setReject('Each attachment must be 25 MB or smaller.');
			return;
		}
	}

	const emailAddress = await env.DB.prepare(
		`SELECT project_id FROM project_email_addresses WHERE inbox_token = ?1 LIMIT 1`
	)
		.bind(inboxToken)
		.first<{ project_id: string }>();
	const projectId = emailAddress?.project_id ?? '';
	const project = projectId
		? await new ProjectEventRepository(env.DB).findById('project', projectId)
		: null;
	if (!project) {
		message.setReject('The project email address is not active.');
		return;
	}

	const sourceMessageId = message.headers.get('message-id')?.trim() || (await digest(raw));
	const subject = parsed.subject?.trim() || '(no subject)';
	const sender = message.from.trim() || 'unknown sender';
	const commentId = `email:${projectId}:${sourceMessageId}`;
	const now = new Date().toISOString();
	await env.DB.prepare(
		`INSERT OR IGNORE INTO project_email_ingest (
			source_message_id, project_id, source_sender, source_subject, comment_id, attachment_count, received_at
		) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
	)
		.bind(sourceMessageId, projectId, sender, subject, commentId, attachments.length, now)
		.run();
	const ingest = await env.DB.prepare(
		`SELECT status, comment_id, attachment_count
		 FROM project_email_ingest
		 WHERE source_message_id = ?1 AND project_id = ?2`
	)
		.bind(sourceMessageId, projectId)
		.first<IngestRow>();
	if (ingest?.status === 'complete') return;

	try {
		await env.DB.prepare(
			`INSERT OR IGNORE INTO project_event_comments (
				id, source, event_id, member_id, author_label, body, mentions_json, created_at
			) VALUES (?1, 'project', ?2, ?3, ?4, ?5, '[]', ?6)`
		)
			.bind(
				commentId,
				projectId,
				`email:${sender.toLocaleLowerCase('en-US')}`,
				`Email · ${sender}`,
				emailComment({
					sender,
					subject,
					text: parsed.text || '',
					attachmentCount: attachments.length
				}),
				now
			)
			.run();

		const uploadedFileCount = await env.DB.prepare(
			`SELECT count(*) AS count
			 FROM project_email_ingest_files
			 WHERE source_message_id = ?1 AND project_id = ?2`
		)
			.bind(sourceMessageId, projectId)
			.first<{ count: number }>();
		if (attachments.length && (uploadedFileCount?.count ?? 0) < attachments.length) {
			const driveRepository = new ProjectDriveRepository(env.DB);
			const knownFolder = await driveRepository.findFolder('project', projectId);
			const upload = await uploadAttachments({
				env,
				projectId,
				projectTitle: project.title,
				attachments,
				knownFolderId: knownFolder?.folderId ?? ''
			});
			if (upload.files.length !== attachments.length) {
				throw new Error('The project Drive folder did not return every attachment');
			}
			await driveRepository.recordUpload({
				source: 'project',
				projectId,
				folder: { folderId: upload.folder.id, folderName: upload.folder.name },
				files: upload.files,
				uploadedByMemberId: `email:${sender.toLocaleLowerCase('en-US')}`,
				now
			});
			await env.DB.batch(
				upload.files.map((file) =>
					env.DB.prepare(
						`INSERT OR IGNORE INTO project_email_ingest_files (
						source_message_id, project_id, drive_file_id, filename, mime_type, byte_size
					) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
					).bind(sourceMessageId, projectId, file.id, file.name, file.mimeType, file.byteSize)
				)
			);
		}

		await env.DB.prepare(
			`UPDATE project_email_ingest
			 SET status = 'complete', completed_at = ?1, last_error = ''
			 WHERE source_message_id = ?2 AND project_id = ?3`
		)
			.bind(new Date().toISOString(), sourceMessageId, projectId)
			.run();
	} catch (cause) {
		const error = cause instanceof Error ? cause.message : 'Unknown project email processing error';
		await env.DB.prepare(
			`UPDATE project_email_ingest
			 SET status = 'failed', last_error = ?1
			 WHERE source_message_id = ?2 AND project_id = ?3`
		)
			.bind(error.slice(0, MAX_ERROR_LENGTH), sourceMessageId, projectId)
			.run();
		console.error(
			JSON.stringify({
				event: 'project_email_processing_failed',
				sourceMessageId,
				projectId,
				error
			})
		);
		throw cause;
	}
}

export default {
	async email(message, env): Promise<void> {
		await processProjectEmail(message, env);
	},
	async fetch(): Promise<Response> {
		return new Response('Not found', { status: 404 });
	}
} satisfies ExportedHandler<ProjectEmailEnv>;
