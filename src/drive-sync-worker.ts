import { OPERATIONS_DOCUMENT_ROOT } from './lib/drive-libraries';
import { CommentRepository } from './lib/server/db/comment-repository';
import { recordProjectDriveUploadActivity } from './lib/server/project-drive/activity';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME_TYPE = 'application/vnd.google-apps.shortcut';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const MAX_STATEMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_STATEMENT_TYPES = new Set(['application/pdf']);
const ALLOWED_STATEMENT_EXTENSIONS = /\.pdf$/iu;
const MAX_PROJECT_FILES = 10;
const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_PROJECT_SHORTCUTS = 25;
const MAX_RECEIPT_BYTES = 25 * 1024 * 1024;

type ServiceAccountCredentials = {
	client_email: string;
	private_key: string;
	token_uri?: string;
};

type DriveFile = {
	id: string;
	name: string;
	mimeType: string;
	parents?: string[];
	createdTime?: string;
	modifiedTime?: string;
	webViewLink?: string;
	size?: string;
	shortcutDetails?: { targetId?: string };
};

type ProjectFolderFile = {
	id: string;
	name: string;
	mimeType: string;
	url: string;
	byteSize: number;
	createdAt: string;
};

type IndexedDriveFile = DriveFile & {
	parentId: string;
	libraryRootId: string;
	rootSectionId: string;
	visibility: 'member' | 'colab' | 'admin';
};

function encodeBase64Url(value: string | ArrayBuffer): string {
	const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function privateKeyBytes(pem: string): ArrayBuffer {
	const body = pem
		.replace('-----BEGIN PRIVATE KEY-----', '')
		.replace('-----END PRIVATE KEY-----', '')
		.replaceAll(/\s/gu, '');
	const binary = atob(body);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes.buffer;
}

async function accessToken(credentials: ServiceAccountCredentials): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claims = encodeBase64Url(
		JSON.stringify({
			iss: credentials.client_email,
			scope: DRIVE_SCOPE,
			aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
			iat: now,
			exp: now + 3600
		})
	);
	const unsigned = `${header}.${claims}`;
	const key = await crypto.subtle.importKey(
		'pkcs8',
		privateKeyBytes(credentials.private_key),
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		key,
		new TextEncoder().encode(unsigned)
	);
	const assertion = `${unsigned}.${encodeBase64Url(signature)}`;
	const response = await fetch(credentials.token_uri || 'https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion
		})
	});
	if (!response.ok) throw new Error(`Google authentication failed (${response.status})`);
	const payload = (await response.json()) as { access_token?: string };
	if (!payload.access_token) throw new Error('Google authentication returned no access token');
	return payload.access_token;
}

function sectionVisibility(name: string): IndexedDriveFile['visibility'] {
	if (/^00\s*[—-]/u.test(name)) return 'member';
	if (/^(01|02|03)\s*[—-]/u.test(name)) return 'colab';
	return 'admin';
}

async function listChildren(token: string, folderId: string): Promise<DriveFile[]> {
	const files: DriveFile[] = [];
	let pageToken = '';
	do {
		const parameters = new URLSearchParams({
			q: `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
			pageSize: '1000',
			fields:
				'nextPageToken,files(id,name,mimeType,parents,createdTime,modifiedTime,webViewLink,size,shortcutDetails(targetId))',
			spaces: 'drive',
			includeItemsFromAllDrives: 'true',
			supportsAllDrives: 'true'
		});
		if (pageToken) parameters.set('pageToken', pageToken);
		const response = await fetch(`https://www.googleapis.com/drive/v3/files?${parameters}`, {
			headers: { authorization: `Bearer ${token}` }
		});
		if (!response.ok) throw new Error(`Drive folder listing failed (${response.status})`);
		const payload = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string };
		files.push(...(payload.files ?? []));
		pageToken = payload.nextPageToken ?? '';
	} while (pageToken);
	return files;
}

function safeFilename(name: string): string {
	const cleaned = name
		.replaceAll(/[\\/:*?"<>|\p{Cc}]/gu, '_')
		.replaceAll(/\s+/gu, ' ')
		.trim()
		.slice(0, 180);
	return cleaned || 'statement.bin';
}

function safeFolderName(name: string): string {
	const cleaned = name
		.replaceAll(/[\\/:*?"<>|\p{Cc}]/gu, '_')
		.replaceAll(/\s+/gu, ' ')
		.trim()
		.slice(0, 180);
	return cleaned || 'Untitled project';
}

function safeMimeType(value: string): string {
	return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/iu.test(value)
		? value
		: 'application/octet-stream';
}

async function uploadFileToDrive(
	token: string,
	folderId: string,
	filename: string,
	mimeType: string,
	content: ArrayBuffer
): Promise<{ id: string; url: string }> {
	const boundary = `finance-statement-${crypto.randomUUID()}`;
	const metadata = JSON.stringify({ name: filename, parents: [folderId] });
	const body = new Blob([
		`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
		`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
		content,
		`\r\n--${boundary}--\r\n`
	]);
	const response = await fetch(
		'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': `multipart/related; boundary=${boundary}`
			},
			body
		}
	);
	if (!response.ok) throw new Error(`Google Drive upload failed (${response.status})`);
	const payload = (await response.json()) as { id?: string; webViewLink?: string };
	if (!payload.id) throw new Error('Google Drive upload returned no file ID');
	return {
		id: payload.id,
		url: payload.webViewLink || `https://drive.google.com/open?id=${encodeURIComponent(payload.id)}`
	};
}

async function createDriveShortcut(
	token: string,
	folderId: string,
	target: Pick<DriveFile, 'id' | 'name'>
): Promise<{ id: string; url: string }> {
	const response = await fetch(
		'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,webViewLink',
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				name: target.name,
				mimeType: SHORTCUT_MIME_TYPE,
				parents: [folderId],
				shortcutDetails: { targetId: target.id }
			})
		}
	);
	if (!response.ok) throw new Error(`Google Drive shortcut creation failed (${response.status})`);
	const payload = (await response.json()) as { id?: string; webViewLink?: string };
	if (!payload.id) throw new Error('Google Drive shortcut creation returned no file ID');
	return {
		id: payload.id,
		url: payload.webViewLink || `https://drive.google.com/open?id=${encodeURIComponent(payload.id)}`
	};
}

async function findDriveFile(token: string, fileId: string): Promise<DriveFile | null> {
	const parameters = new URLSearchParams({
		fields: 'id,name,mimeType,parents,webViewLink',
		supportsAllDrives: 'true'
	});
	const response = await fetch(
		`https://www.googleapis.com/drive/v3/files/${fileId}?${parameters}`,
		{
			headers: { authorization: `Bearer ${token}` }
		}
	);
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Google Drive folder lookup failed (${response.status})`);
	return (await response.json()) as DriveFile;
}

async function createDriveFolder(
	token: string,
	parentFolderId: string,
	name: string
): Promise<{ id: string; name: string; url: string }> {
	const response = await fetch(
		'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink',
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE, parents: [parentFolderId] })
		}
	);
	if (!response.ok) throw new Error(`Google Drive folder creation failed (${response.status})`);
	const payload = (await response.json()) as { id?: string; name?: string; webViewLink?: string };
	if (!payload.id || !payload.name)
		throw new Error('Google Drive folder creation returned no folder');
	return {
		id: payload.id,
		name: payload.name,
		url: payload.webViewLink || `https://drive.google.com/open?id=${encodeURIComponent(payload.id)}`
	};
}

async function projectFolder(
	token: string,
	rootFolderId: string,
	knownFolderId: string,
	projectTitle: string
): Promise<{ id: string; name: string; url: string }> {
	if (knownFolderId) {
		const knownFolder = await findDriveFile(token, knownFolderId);
		if (
			knownFolder?.id &&
			knownFolder.mimeType === FOLDER_MIME_TYPE &&
			knownFolder.parents?.includes(rootFolderId)
		) {
			return {
				id: knownFolder.id,
				name: knownFolder.name,
				url:
					knownFolder.webViewLink ||
					`https://drive.google.com/open?id=${encodeURIComponent(knownFolder.id)}`
			};
		}
	}

	const folderName = safeFolderName(projectTitle);
	const existingFolder = (await listChildren(token, rootFolderId)).find(
		(file) => file.mimeType === FOLDER_MIME_TYPE && file.name === folderName
	);
	if (existingFolder?.id) {
		return {
			id: existingFolder.id,
			name: existingFolder.name,
			url:
				existingFolder.webViewLink ||
				`https://drive.google.com/open?id=${encodeURIComponent(existingFolder.id)}`
		};
	}
	return createDriveFolder(token, rootFolderId, folderName);
}

function driveFileUrl(file: DriveFile): string {
	return file.webViewLink || `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`;
}

async function projectFolderFiles(token: string, folderId: string): Promise<ProjectFolderFile[]> {
	const files = await listChildren(token, folderId);
	return files
		.filter((file) => Boolean(file.id && file.name))
		.map((file) => ({
			id: file.id,
			name: file.name,
			mimeType: file.mimeType,
			url: driveFileUrl(file),
			byteSize: Number(file.size ?? 0),
			createdAt: file.createdTime || file.modifiedTime || new Date().toISOString()
		}));
}

async function receiveFinanceStatement(request: Request, env: DriveSyncEnv): Promise<Response> {
	const form = await request.formData();
	const month = typeof form.get('month') === 'string' ? String(form.get('month')).trim() : '';
	const accountKey =
		typeof form.get('accountKey') === 'string' ? String(form.get('accountKey')).trim() : '';
	const statement = form.get('statement');
	if (!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(month)) {
		return Response.json({ message: 'A valid reconciliation month is required.' }, { status: 400 });
	}
	if (!['st-marys-bank', 'st-marys-credit-card', 'paypal', 'venmo'].includes(accountKey)) {
		return Response.json({ message: 'A valid account is required.' }, { status: 400 });
	}
	if (!(statement instanceof File) || !statement.size) {
		return Response.json({ message: 'A statement file is required.' }, { status: 400 });
	}
	if (statement.size > MAX_STATEMENT_BYTES) {
		return Response.json({ message: 'Statements must be 20 MB or smaller.' }, { status: 413 });
	}
	if (
		!ALLOWED_STATEMENT_TYPES.has(statement.type) &&
		!ALLOWED_STATEMENT_EXTENSIONS.test(statement.name)
	) {
		return Response.json({ message: 'Only PDF statements are accepted.' }, { status: 400 });
	}

	try {
		const credentials = JSON.parse(
			env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
		) as ServiceAccountCredentials;
		if (!credentials.client_email || !credentials.private_key) {
			throw new Error('Service account JSON is missing client_email or private_key');
		}
		const filename = `${month}-${accountKey}-${safeFilename(statement.name)}`;
		const file = await uploadFileToDrive(
			await accessToken(credentials),
			env.FINANCE_STATEMENTS_FOLDER_ID,
			filename,
			safeMimeType(statement.type),
			await statement.arrayBuffer()
		);
		return Response.json({ file: { ...file, name: filename } });
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Unknown upload error';
		console.error(JSON.stringify({ event: 'finance_statement_upload_failed', message }));
		return Response.json(
			{ message: 'Could not save the statement to Google Drive.' },
			{ status: 502 }
		);
	}
}

async function receiveReceiptAttachment(request: Request, env: DriveSyncEnv): Promise<Response> {
	const form = await request.formData();
	const folderId =
		typeof form.get('folderId') === 'string' ? String(form.get('folderId')).trim() : '';
	const receipt = form.get('receipt');
	if (!/^[A-Za-z0-9_-]{10,}$/u.test(folderId)) {
		return Response.json({ message: 'A valid receipt folder is required.' }, { status: 400 });
	}
	if (!(receipt instanceof File) || !receipt.size) {
		return Response.json({ message: 'A receipt attachment is required.' }, { status: 400 });
	}
	if (receipt.size > MAX_RECEIPT_BYTES) {
		return Response.json({ message: 'Receipts must be 25 MB or smaller.' }, { status: 413 });
	}

	try {
		const credentials = JSON.parse(
			env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
		) as ServiceAccountCredentials;
		if (!credentials.client_email || !credentials.private_key) {
			throw new Error('Service account JSON is missing client_email or private_key');
		}
		const file = await uploadFileToDrive(
			await accessToken(credentials),
			folderId,
			safeFilename(receipt.name),
			safeMimeType(receipt.type),
			await receipt.arrayBuffer()
		);
		return Response.json({ file });
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Unknown upload error';
		console.error(JSON.stringify({ event: 'receipt_attachment_upload_failed', message }));
		return Response.json(
			{ message: 'Could not save the receipt to Google Drive.' },
			{ status: 502 }
		);
	}
}

async function receiveProjectFiles(request: Request, env: DriveSyncEnv): Promise<Response> {
	const form = await request.formData();
	const projectId =
		typeof form.get('projectId') === 'string' ? String(form.get('projectId')).trim() : '';
	const projectTitle =
		typeof form.get('projectTitle') === 'string' ? String(form.get('projectTitle')).trim() : '';
	const knownFolderId =
		typeof form.get('folderId') === 'string' ? String(form.get('folderId')).trim() : '';
	const files = form.getAll('files').filter((value): value is File => value instanceof File);
	if (!/^\d+$/u.test(projectId) || !projectTitle) {
		return Response.json({ message: 'A valid project is required.' }, { status: 400 });
	}
	if (!files.length || files.length > MAX_PROJECT_FILES) {
		return Response.json(
			{ message: `Choose between 1 and ${MAX_PROJECT_FILES} files.` },
			{ status: 400 }
		);
	}
	for (const file of files) {
		if (!file.size)
			return Response.json({ message: `${file.name || 'That file'} is empty.` }, { status: 400 });
		if (file.size > MAX_PROJECT_FILE_BYTES) {
			return Response.json({ message: `${file.name} must be 25 MB or smaller.` }, { status: 413 });
		}
	}

	try {
		const credentials = JSON.parse(
			env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
		) as ServiceAccountCredentials;
		if (!credentials.client_email || !credentials.private_key) {
			throw new Error('Service account JSON is missing client_email or private_key');
		}
		const token = await accessToken(credentials);
		const folder = await projectFolder(
			token,
			env.PROJECT_FILES_ROOT_FOLDER_ID,
			knownFolderId,
			projectTitle
		);
		const uploaded = [];
		for (const file of files) {
			const uploadedFile = await uploadFileToDrive(
				token,
				folder.id,
				safeFilename(file.name),
				safeMimeType(file.type),
				await file.arrayBuffer()
			);
			uploaded.push({
				...uploadedFile,
				name: safeFilename(file.name),
				mimeType: safeMimeType(file.type),
				byteSize: file.size
			});
		}
		return Response.json({ folder, files: uploaded });
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Unknown upload error';
		console.error(JSON.stringify({ event: 'project_drive_upload_failed', projectId, message }));
		return Response.json(
			{ message: 'Could not save the files to the project Drive folder.' },
			{ status: 502 }
		);
	}
}

async function receiveProjectShortcuts(request: Request, env: DriveSyncEnv): Promise<Response> {
	const payload = (await request.json().catch(() => null)) as {
		projectId?: unknown;
		projectTitle?: unknown;
		folderId?: unknown;
		targetIds?: unknown;
	} | null;
	const projectId = typeof payload?.projectId === 'string' ? payload.projectId.trim() : '';
	const projectTitle = typeof payload?.projectTitle === 'string' ? payload.projectTitle.trim() : '';
	const knownFolderId = typeof payload?.folderId === 'string' ? payload.folderId.trim() : '';
	const targetIds = [
		...new Set(
			(Array.isArray(payload?.targetIds) ? payload.targetIds : [])
				.filter((value): value is string => typeof value === 'string')
				.map((value) => value.trim())
				.filter((value) => /^[A-Za-z0-9_-]{10,}$/u.test(value))
		)
	].slice(0, MAX_PROJECT_SHORTCUTS);
	if (!/^\d+$/u.test(projectId) || !projectTitle) {
		return Response.json({ message: 'A valid project is required.' }, { status: 400 });
	}
	if (!targetIds.length) {
		return Response.json({ message: 'Choose at least one Drive document.' }, { status: 400 });
	}

	try {
		const credentials = JSON.parse(
			env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
		) as ServiceAccountCredentials;
		if (!credentials.client_email || !credentials.private_key) {
			throw new Error('Service account JSON is missing client_email or private_key');
		}
		const token = await accessToken(credentials);
		const folder = await projectFolder(
			token,
			env.PROJECT_FILES_ROOT_FOLDER_ID,
			knownFolderId,
			projectTitle
		);
		const now = new Date().toISOString();
		const files: Array<ProjectFolderFile & { targetId: string }> = [];
		let skipped = 0;
		for (const targetId of targetIds) {
			try {
				const target = await findDriveFile(token, targetId);
				if (
					!target?.id ||
					!target.name ||
					target.mimeType === FOLDER_MIME_TYPE ||
					target.mimeType === SHORTCUT_MIME_TYPE ||
					target.parents?.includes(folder.id)
				) {
					skipped += 1;
					continue;
				}
				const shortcut = await createDriveShortcut(token, folder.id, target);
				files.push({
					id: shortcut.id,
					targetId,
					name: target.name,
					mimeType: SHORTCUT_MIME_TYPE,
					url: shortcut.url,
					byteSize: 0,
					createdAt: now
				});
			} catch (cause) {
				skipped += 1;
				console.warn(
					JSON.stringify({
						event: 'project_drive_shortcut_skipped',
						projectId,
						targetId,
						message: cause instanceof Error ? cause.message : 'Unknown Drive shortcut error'
					})
				);
			}
		}
		return Response.json({ folder, files, skipped });
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Unknown Drive shortcut error';
		console.error(JSON.stringify({ event: 'project_drive_shortcut_failed', projectId, message }));
		return Response.json(
			{ message: 'Could not prepare the project Drive folder for linked documents.' },
			{ status: 502 }
		);
	}
}

async function receiveProjectFolder(request: Request, env: DriveSyncEnv): Promise<Response> {
	const form = await request.formData();
	const projectId =
		typeof form.get('projectId') === 'string' ? String(form.get('projectId')).trim() : '';
	const projectTitle =
		typeof form.get('projectTitle') === 'string' ? String(form.get('projectTitle')).trim() : '';
	const knownFolderId =
		typeof form.get('folderId') === 'string' ? String(form.get('folderId')).trim() : '';
	if (!/^\d+$/u.test(projectId) || !projectTitle) {
		return Response.json({ message: 'A valid project is required.' }, { status: 400 });
	}

	try {
		const credentials = JSON.parse(
			env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
		) as ServiceAccountCredentials;
		if (!credentials.client_email || !credentials.private_key) {
			throw new Error('Service account JSON is missing client_email or private_key');
		}
		const token = await accessToken(credentials);
		const folder = await projectFolder(
			token,
			env.PROJECT_FILES_ROOT_FOLDER_ID,
			knownFolderId,
			projectTitle
		);
		const files = await projectFolderFiles(token, folder.id);
		return Response.json({ folder, files });
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Unknown folder error';
		console.error(JSON.stringify({ event: 'project_drive_folder_failed', projectId, message }));
		return Response.json(
			{ message: 'Could not prepare the project Drive folder.' },
			{ status: 502 }
		);
	}
}

export async function indexFolderTree(
	token: string,
	rootFolderId: string,
	adminOnly = false
): Promise<IndexedDriveFile[]> {
	const rootChildren = await listChildren(token, rootFolderId);
	const indexed: IndexedDriveFile[] = [];
	const folders: Array<{
		id: string;
		rootSectionId: string;
		visibility: IndexedDriveFile['visibility'];
	}> = [];

	for (const file of rootChildren) {
		const visibility = adminOnly
			? 'admin'
			: file.mimeType === FOLDER_MIME_TYPE
				? sectionVisibility(file.name)
				: 'colab';
		indexed.push({
			...file,
			parentId: rootFolderId,
			libraryRootId: rootFolderId,
			rootSectionId: file.id,
			visibility
		});
		if (file.mimeType === FOLDER_MIME_TYPE) {
			folders.push({ id: file.id, rootSectionId: file.id, visibility });
		}
	}

	for (let cursor = 0; cursor < folders.length; cursor += 1) {
		const folder = folders[cursor];
		const children = await listChildren(token, folder.id);
		for (const file of children) {
			indexed.push({
				...file,
				parentId: folder.id,
				libraryRootId: rootFolderId,
				rootSectionId: folder.rootSectionId,
				visibility: folder.visibility
			});
			if (file.mimeType === FOLDER_MIME_TYPE) {
				folders.push({
					id: file.id,
					rootSectionId: folder.rootSectionId,
					visibility: folder.visibility
				});
			}
		}
	}
	return indexed;
}

type StoredProjectFolder = {
	source: 'project';
	project_id: string;
	folder_id: string;
	folder_name: string;
};

async function synchronizeProjectFolderContents(
	token: string,
	env: DriveSyncEnv,
	syncedAt: string
): Promise<number> {
	const result = await env.DB.prepare(
		`SELECT source, project_id, folder_id, folder_name
		 FROM project_drive_folders
		 WHERE source = 'project'`
	).all<StoredProjectFolder>();
	let fileCount = 0;
	for (const folder of result.results) {
		try {
			const files = await projectFolderFiles(token, folder.folder_id);
			const storedFiles = await env.DB.prepare(
				`SELECT id FROM project_drive_files WHERE source = ?1 AND project_id = ?2`
			)
				.bind(folder.source, folder.project_id)
				.all<{ id: string }>();
			const storedFileIds = new Set(storedFiles.results.map((file) => file.id));
			const newlyObservedFiles = files.filter((file) => !storedFileIds.has(file.id));
			await env.DB.prepare(
				`UPDATE project_drive_folders
				 SET updated_at = ?3
				 WHERE source = ?1 AND project_id = ?2`
			)
				.bind(folder.source, folder.project_id, syncedAt)
				.run();
			await env.DB.prepare(
				`DELETE FROM project_drive_files
				 WHERE source = ?1 AND project_id = ?2`
			)
				.bind(folder.source, folder.project_id)
				.run();
			for (let offset = 0; offset < files.length; offset += 75) {
				const statements = files.slice(offset, offset + 75).map((file) =>
					env.DB.prepare(
						`INSERT INTO project_drive_files (
								id, source, project_id, folder_id, name, mime_type, web_view_url,
								byte_size, uploaded_by_member_id, uploaded_at
							) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '', ?9)
							ON CONFLICT(id) DO UPDATE SET
								folder_id = excluded.folder_id,
								name = excluded.name,
								mime_type = excluded.mime_type,
								web_view_url = excluded.web_view_url,
								byte_size = excluded.byte_size,
								uploaded_by_member_id = excluded.uploaded_by_member_id,
								uploaded_at = excluded.uploaded_at`
					).bind(
						file.id,
						folder.source,
						folder.project_id,
						folder.folder_id,
						file.name,
						file.mimeType,
						file.url,
						file.byteSize,
						file.createdAt
					)
				);
				await env.DB.batch(statements);
			}
			for (let offset = 0; offset < newlyObservedFiles.length; offset += 10) {
				await recordProjectDriveUploadActivity(new CommentRepository(env.DB), {
					source: 'project',
					projectId: folder.project_id,
					files: newlyObservedFiles.slice(offset, offset + 10),
					origin: 'drive',
					now: syncedAt
				});
			}
			fileCount += files.length;
		} catch (cause) {
			console.warn(
				JSON.stringify({
					event: 'project_drive_folder_sync_failed',
					projectId: folder.project_id,
					message: cause instanceof Error ? cause.message : 'Unknown synchronization error'
				})
			);
		}
	}
	return fileCount;
}

async function synchronize(env: DriveSyncEnv): Promise<{ count: number; syncedAt: string }> {
	const startedAt = new Date().toISOString();
	await env.DB.prepare(
		"UPDATE drive_sync_state SET status = 'running', started_at = ?, error_message = '' WHERE id = 1"
	)
		.bind(startedAt)
		.run();
	try {
		const credentials = JSON.parse(
			env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
		) as ServiceAccountCredentials;
		if (!credentials.client_email || !credentials.private_key) {
			throw new Error('Service account JSON is missing client_email or private_key');
		}
		const token = await accessToken(credentials);
		const files = [
			...(await indexFolderTree(token, env.GOOGLE_DRIVE_ROOT_FOLDER_ID)),
			...(await indexFolderTree(token, OPERATIONS_DOCUMENT_ROOT, true))
		];
		const syncRunId = crypto.randomUUID();
		const syncedAt = new Date().toISOString();
		for (let offset = 0; offset < files.length; offset += 75) {
			const statements = files.slice(offset, offset + 75).map((file) =>
				env.DB.prepare(
					`INSERT INTO drive_documents (
						id, parent_id, root_section_id, name, mime_type, web_view_url, created_at,
						modified_at, byte_size, is_folder, is_shortcut, shortcut_target_id,
						visibility, sync_run_id, synced_at, library_root_id
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT(id) DO UPDATE SET
						parent_id = excluded.parent_id, root_section_id = excluded.root_section_id,
						name = excluded.name, mime_type = excluded.mime_type,
						web_view_url = excluded.web_view_url, created_at = excluded.created_at,
						modified_at = excluded.modified_at, byte_size = excluded.byte_size,
						is_folder = excluded.is_folder, is_shortcut = excluded.is_shortcut,
						shortcut_target_id = excluded.shortcut_target_id,
						visibility = excluded.visibility, sync_run_id = excluded.sync_run_id,
						synced_at = excluded.synced_at, library_root_id = excluded.library_root_id`
				).bind(
					file.id,
					file.parentId,
					file.rootSectionId,
					file.name,
					file.mimeType,
					file.webViewLink ?? '',
					file.createdTime ?? '',
					file.modifiedTime ?? '',
					Number(file.size ?? 0),
					file.mimeType === FOLDER_MIME_TYPE ? 1 : 0,
					file.mimeType === SHORTCUT_MIME_TYPE ? 1 : 0,
					file.shortcutDetails?.targetId ?? '',
					file.visibility,
					syncRunId,
					syncedAt,
					file.libraryRootId
				)
			);
			await env.DB.batch(statements);
		}
		const projectFileCount = await synchronizeProjectFolderContents(token, env, syncedAt);
		await env.DB.batch([
			env.DB.prepare('DELETE FROM drive_documents WHERE sync_run_id <> ?').bind(syncRunId),
			env.DB.prepare(
				"UPDATE drive_sync_state SET status = 'complete', completed_at = ?, item_count = ?, error_message = '' WHERE id = 1"
			).bind(syncedAt, files.length)
		]);
		return { count: files.length + projectFileCount, syncedAt };
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Unknown synchronization error';
		await env.DB.prepare(
			"UPDATE drive_sync_state SET status = 'failed', completed_at = ?, error_message = ? WHERE id = 1"
		)
			.bind(new Date().toISOString(), message.slice(0, 500))
			.run();
		throw cause;
	}
}

async function health(env: DriveSyncEnv): Promise<Response> {
	const state = await env.DB.prepare(
		'SELECT status, completed_at, item_count FROM drive_sync_state WHERE id = 1'
	).first<{ status: string; completed_at: string; item_count: number }>();
	return Response.json({
		ok: state?.status === 'complete',
		service: 'drive-dashboard-sync',
		status: state?.status ?? 'pending',
		lastSyncedAt: state?.completed_at ?? '',
		itemCount: state?.item_count ?? 0
	});
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === 'POST' && new URL(request.url).pathname === '/receipt-attachments') {
			return receiveReceiptAttachment(request, env);
		}
		if (request.method === 'POST' && new URL(request.url).pathname === '/finance-statements') {
			return receiveFinanceStatement(request, env);
		}
		if (request.method === 'POST' && new URL(request.url).pathname === '/project-files') {
			return receiveProjectFiles(request, env);
		}
		if (request.method === 'POST' && new URL(request.url).pathname === '/project-shortcuts') {
			return receiveProjectShortcuts(request, env);
		}
		if (request.method === 'POST' && new URL(request.url).pathname === '/project-folder') {
			return receiveProjectFolder(request, env);
		}
		if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
		const state = await env.DB.prepare('SELECT status FROM drive_sync_state WHERE id = 1').first<{
			status: string;
		}>();
		if (!state || state.status === 'pending') {
			ctx.waitUntil(
				synchronize(env).catch((cause) =>
					console.error(
						JSON.stringify({
							event: 'drive_initial_sync_failed',
							message: cause instanceof Error ? cause.message : 'Unknown synchronization error'
						})
					)
				)
			);
		}
		return health(env);
	},
	async scheduled(controller, env, ctx): Promise<void> {
		ctx.waitUntil(
			synchronize(env).then((result) =>
				console.log(
					JSON.stringify({
						event: 'drive_sync_completed',
						cron: controller.cron,
						scheduledTime: controller.scheduledTime,
						...result
					})
				)
			)
		);
	}
} satisfies ExportedHandler<DriveSyncEnv>;
