const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME_TYPE = 'application/vnd.google-apps.shortcut';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';

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

type IndexedDriveFile = DriveFile & {
	parentId: string;
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

async function indexFolderTree(token: string, rootFolderId: string): Promise<IndexedDriveFile[]> {
	const rootChildren = await listChildren(token, rootFolderId);
	const indexed: IndexedDriveFile[] = [];
	const folders: Array<{
		id: string;
		rootSectionId: string;
		visibility: IndexedDriveFile['visibility'];
	}> = [];

	for (const file of rootChildren) {
		const visibility = file.mimeType === FOLDER_MIME_TYPE ? sectionVisibility(file.name) : 'colab';
		indexed.push({
			...file,
			parentId: rootFolderId,
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
		const files = await indexFolderTree(token, env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
		const syncRunId = crypto.randomUUID();
		const syncedAt = new Date().toISOString();
		for (let offset = 0; offset < files.length; offset += 75) {
			const statements = files.slice(offset, offset + 75).map((file) =>
				env.DB.prepare(
					`INSERT INTO drive_documents (
						id, parent_id, root_section_id, name, mime_type, web_view_url, created_at,
						modified_at, byte_size, is_folder, is_shortcut, shortcut_target_id,
						visibility, sync_run_id, synced_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT(id) DO UPDATE SET
						parent_id = excluded.parent_id, root_section_id = excluded.root_section_id,
						name = excluded.name, mime_type = excluded.mime_type,
						web_view_url = excluded.web_view_url, created_at = excluded.created_at,
						modified_at = excluded.modified_at, byte_size = excluded.byte_size,
						is_folder = excluded.is_folder, is_shortcut = excluded.is_shortcut,
						shortcut_target_id = excluded.shortcut_target_id,
						visibility = excluded.visibility, sync_run_id = excluded.sync_run_id,
						synced_at = excluded.synced_at`
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
					syncedAt
				)
			);
			await env.DB.batch(statements);
		}
		await env.DB.batch([
			env.DB.prepare('DELETE FROM drive_documents WHERE sync_run_id <> ?').bind(syncRunId),
			env.DB.prepare(
				"UPDATE drive_sync_state SET status = 'complete', completed_at = ?, item_count = ?, error_message = '' WHERE id = 1"
			).bind(syncedAt, files.length)
		]);
		return { count: files.length, syncedAt };
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
