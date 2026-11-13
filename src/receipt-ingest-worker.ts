import PostalMime, { type Attachment } from 'postal-mime';

const MAX_ERROR_LENGTH = 500;

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

async function uploadToReceiptFolder(
	env: ReceiptEnv,
	filename: string,
	mimeType: string,
	content: ArrayBuffer
): Promise<string> {
	const form = new FormData();
	form.set('folderId', env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID);
	form.set('receipt', new File([content], filename, { type: mimeType }), filename);
	const response = await env.RECEIPT_DRIVE.fetch(
		new Request('https://finance-drive.internal/receipt-attachments', {
			method: 'POST',
			body: form
		})
	);
	const payload = (await response.json().catch(() => null)) as {
		file?: { id?: string };
		message?: string;
	} | null;
	if (!response.ok || !payload?.file?.id) {
		throw new Error(payload?.message || 'Google Drive could not save the receipt');
	}
	return payload.file.id;
}

function receiptAttachments(attachments: Attachment[]): Attachment[] {
	return attachments.filter(
		(attachment) =>
			attachment.disposition === 'attachment' || Boolean(attachment.filename && !attachment.related)
	);
}

async function processAttachment(
	env: ReceiptEnv,
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
		const driveFileId = await uploadToReceiptFolder(env, filename, mimeType, content);
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
		for (const [position, attachment] of attachments.entries()) {
			await processAttachment(env, sourceMessageId, attachment, position);
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
