import PostalMime, { type Attachment } from 'postal-mime';

const DRIVE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const MAX_ERROR_LENGTH = 500;

type ServiceAccountCredentials = {
	client_email: string;
	private_key: string;
	token_uri?: string;
};

type StoredReceipt = {
	drive_file_id: string | null;
	quickbooks_message_id: string | null;
};

function encodeBase64Url(value: string | ArrayBuffer): string {
	const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
	const body = pem
		.replace('-----BEGIN PRIVATE KEY-----', '')
		.replace('-----END PRIVATE KEY-----', '')
		.replaceAll(/\s/gu, '');
	const binary = atob(body);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes.buffer;
}

async function googleAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claims = encodeBase64Url(
		JSON.stringify({
			iss: credentials.client_email,
			scope: DRIVE_UPLOAD_SCOPE,
			aud: credentials.token_uri ?? 'https://oauth2.googleapis.com/token',
			iat: now,
			exp: now + 3600
		})
	);
	const unsignedToken = `${header}.${claims}`;
	const key = await crypto.subtle.importKey(
		'pkcs8',
		pemToArrayBuffer(credentials.private_key),
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		key,
		new TextEncoder().encode(unsignedToken)
	);
	const assertion = `${unsignedToken}.${encodeBase64Url(signature)}`;
	const response = await fetch(credentials.token_uri ?? 'https://oauth2.googleapis.com/token', {
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

function safeFilename(name: string | null, position: number): string {
	const cleaned = (name ?? '')
		.replaceAll(/[\\/:*?"<>|\p{Cc}]/gu, '_')
		.trim()
		.slice(0, 180);
	return cleaned || `receipt-${position + 1}.bin`;
}

function safeMimeType(mimeType: string): string {
	return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/iu.test(mimeType)
		? mimeType
		: 'application/octet-stream';
}

async function digest(value: ArrayBuffer): Promise<string> {
	return encodeBase64Url(await crypto.subtle.digest('SHA-256', value));
}

async function uploadToGoogleDrive(
	token: string,
	folderId: string,
	filename: string,
	mimeType: string,
	content: ArrayBuffer
): Promise<string> {
	const boundary = `receipt-${crypto.randomUUID()}`;
	const metadata = JSON.stringify({ name: filename, parents: [folderId] });
	const body = new Blob([
		`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
		`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
		content,
		`\r\n--${boundary}--\r\n`
	]);
	const response = await fetch(
		'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',
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
	const payload = (await response.json()) as { id?: string };
	if (!payload.id) throw new Error('Google Drive upload returned no file ID');
	return payload.id;
}

function receiptAttachments(attachments: Attachment[]): Attachment[] {
	return attachments.filter(
		(attachment) =>
			attachment.disposition === 'attachment' || Boolean(attachment.filename && !attachment.related)
	);
}

async function processAttachment(
	env: ReceiptEnv,
	googleToken: string,
	sourceMessageId: string,
	attachment: Attachment,
	position: number
): Promise<void> {
	const filename = safeFilename(attachment.filename, position);
	const mimeType = safeMimeType(attachment.mimeType);
	if (!(attachment.content instanceof ArrayBuffer)) {
		throw new Error('Receipt attachment was not decoded as binary content');
	}
	const content = attachment.content;
	const attachmentHash = await digest(content);

	await env.DB.prepare(
		`INSERT OR IGNORE INTO receipt_ingest_files
		(source_message_id, attachment_hash, filename, mime_type)
		VALUES (?, ?, ?, ?)`
	)
		.bind(sourceMessageId, attachmentHash, filename, mimeType)
		.run();
	const stored = await env.DB.prepare(
		`SELECT drive_file_id, quickbooks_message_id FROM receipt_ingest_files
		WHERE source_message_id = ? AND attachment_hash = ?`
	)
		.bind(sourceMessageId, attachmentHash)
		.first<StoredReceipt>();

	if (!stored?.drive_file_id) {
		const driveFileId = await uploadToGoogleDrive(
			googleToken,
			env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID,
			filename,
			mimeType,
			content
		);
		await env.DB.prepare(
			`UPDATE receipt_ingest_files SET drive_file_id = ?
			WHERE source_message_id = ? AND attachment_hash = ?`
		)
			.bind(driveFileId, sourceMessageId, attachmentHash)
			.run();
	}

	if (!stored?.quickbooks_message_id) {
		const sent = await env.EMAIL.send({
			to: env.QUICKBOOKS_RECEIPT_EMAIL,
			from: env.RECEIPT_FROM_EMAIL,
			subject: `Receipt: ${filename}`,
			text: 'Receipt attached for QuickBooks processing.',
			html: '<p>Receipt attached for QuickBooks processing.</p>',
			attachments: [{ content, filename, type: mimeType, disposition: 'attachment' }]
		});
		await env.DB.prepare(
			`UPDATE receipt_ingest_files SET quickbooks_message_id = ?
			WHERE source_message_id = ? AND attachment_hash = ?`
		)
			.bind(sent.messageId, sourceMessageId, attachmentHash)
			.run();
	}
}

async function notifyCompletion(
	env: ReceiptEnv,
	count: number,
	sourceSubject: string
): Promise<string> {
	const sent = await env.EMAIL.send({
		to: env.NOTIFICATION_EMAIL,
		from: env.RECEIPT_FROM_EMAIL,
		subject: `Receipt processing complete (${count})`,
		text: `${count} receipt${count === 1 ? '' : 's'} from “${sourceSubject}” were saved to Google Drive and sent to QuickBooks.`,
		html: `<p>${count} receipt${count === 1 ? '' : 's'} from <strong>${escapeHtml(sourceSubject)}</strong> were saved to Google Drive and sent to QuickBooks.</p>`
	});
	return sent.messageId;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

async function processReceipt(message: ForwardableEmailMessage, env: ReceiptEnv): Promise<void> {
	if (message.to.toLowerCase() !== env.RECEIPT_INBOX_EMAIL.toLowerCase()) {
		message.setReject('This inbox only accepts receipts.');
		return;
	}
	const raw = await new Response(message.raw).arrayBuffer();
	const parsed = await PostalMime.parse(raw, { attachmentEncoding: 'arraybuffer' });
	const attachments = receiptAttachments(parsed.attachments);
	if (attachments.length === 0) {
		message.setReject('Attach at least one receipt file.');
		return;
	}
	const sourceMessageId = message.headers.get('message-id')?.trim() || (await digest(raw));
	const sourceSubject = parsed.subject?.trim() || '(no subject)';
	const now = new Date().toISOString();

	await env.DB.prepare(
		`INSERT OR IGNORE INTO receipt_ingest
		(source_message_id, source_sender, source_subject, received_at)
		VALUES (?, ?, ?, ?)`
	)
		.bind(sourceMessageId, message.from, sourceSubject, now)
		.run();
	const existing = await env.DB.prepare(
		`SELECT status, notification_message_id FROM receipt_ingest WHERE source_message_id = ?`
	)
		.bind(sourceMessageId)
		.first<{ status: string; notification_message_id: string | null }>();
	if (existing?.status === 'complete') return;

	try {
		const credentials = JSON.parse(
			env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
		) as ServiceAccountCredentials;
		if (!credentials.client_email || !credentials.private_key) {
			throw new Error('Google Drive service-account credentials are incomplete');
		}
		const googleToken = await googleAccessToken(credentials);
		for (const [position, attachment] of attachments.entries()) {
			await processAttachment(env, googleToken, sourceMessageId, attachment, position);
		}

		if (!existing?.notification_message_id) {
			const notificationMessageId = await notifyCompletion(env, attachments.length, sourceSubject);
			await env.DB.prepare(
				`UPDATE receipt_ingest SET notification_message_id = ? WHERE source_message_id = ?`
			)
				.bind(notificationMessageId, sourceMessageId)
				.run();
		}
		await env.DB.prepare(
			`UPDATE receipt_ingest
			SET status = 'complete', completed_at = ?, last_error = ''
			WHERE source_message_id = ?`
		)
			.bind(new Date().toISOString(), sourceMessageId)
			.run();
	} catch (cause) {
		const error = cause instanceof Error ? cause.message : 'Unknown receipt processing error';
		await env.DB.prepare(
			`UPDATE receipt_ingest SET status = 'failed', last_error = ? WHERE source_message_id = ?`
		)
			.bind(error.slice(0, MAX_ERROR_LENGTH), sourceMessageId)
			.run();
		console.error(JSON.stringify({ event: 'receipt_processing_failed', sourceMessageId, error }));
		throw cause;
	}
}

export default {
	async email(message, env): Promise<void> {
		await processReceipt(message, env);
	},
	async fetch(): Promise<Response> {
		return new Response('Not found', { status: 404 });
	}
} satisfies ExportedHandler<ReceiptEnv>;
