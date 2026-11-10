import PostalMime, { type Attachment } from 'postal-mime';
import { FinanceReportSnapshotRepository } from '$lib/server/db/finance-report-snapshot-repository';
import { parseScheduledQuickBooksReport } from '$lib/server/finance-reports/parser';

function encodeBase64Url(value: ArrayBuffer): string {
	let binary = '';
	for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

async function sourceMessageId(
	message: ForwardableEmailMessage,
	raw: ArrayBuffer
): Promise<string> {
	return (
		message.headers.get('message-id')?.trim() ||
		`hash:${encodeBase64Url(await crypto.subtle.digest('SHA-256', raw))}`
	);
}

function isWorkbook(attachment: Attachment): boolean {
	const filename = attachment.filename?.toLowerCase() ?? '';
	return (
		filename.endsWith('.xlsx') ||
		attachment.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	);
}

function attachmentName(attachment: Attachment, position: number): string {
	return attachment.filename?.trim().slice(0, 180) || `quickbooks-report-${position + 1}.xlsx`;
}

async function processFinanceReport(
	message: ForwardableEmailMessage,
	env: FinanceReportIngestEnv
): Promise<void> {
	if (message.to.toLowerCase() !== env.FINANCE_REPORTS_INBOX_EMAIL.toLowerCase()) {
		message.setReject('This inbox only accepts scheduled QuickBooks reports.');
		return;
	}
	const raw = await new Response(message.raw).arrayBuffer();
	const parsed = await PostalMime.parse(raw, { attachmentEncoding: 'arraybuffer' });
	const receivedAt = new Date().toISOString();
	const id = await sourceMessageId(message, raw);
	const subject = parsed.subject?.trim() || '(no subject)';
	const repository = new FinanceReportSnapshotRepository(env.DB);
	const state = await repository.startIngest({
		sourceMessageId: id,
		sourceSender: message.from,
		sourceSubject: subject,
		receivedAt
	});
	if (state === 'complete' || state === 'processing') return;

	try {
		let accepted = 0;
		for (const [position, attachment] of parsed.attachments.entries()) {
			if (!isWorkbook(attachment) || !(attachment.content instanceof ArrayBuffer)) continue;
			const report = parseScheduledQuickBooksReport(attachment.content, receivedAt);
			if (!report) continue;
			await repository.saveReport({
				report,
				filename: attachmentName(attachment, position),
				receivedAt
			});
			accepted += 1;
		}
		if (!accepted) {
			throw new Error('No supported QuickBooks Excel attachment was found.');
		}
		await repository.completeIngest(id, accepted, receivedAt);
		console.log(
			JSON.stringify({
				event: 'finance_scheduled_report_processed',
				sourceMessageId: id,
				acceptedAttachmentCount: accepted
			})
		);
	} catch (cause) {
		const error =
			cause instanceof Error ? cause.message : 'Unknown finance report processing error';
		await repository.failIngest(id, error, receivedAt);
		console.error(
			JSON.stringify({ event: 'finance_scheduled_report_failed', sourceMessageId: id, error })
		);
	}
}

export default {
	async email(message, env): Promise<void> {
		await processFinanceReport(message, env);
	},
	async fetch(): Promise<Response> {
		return new Response('Not found', { status: 404 });
	}
} satisfies ExportedHandler<FinanceReportIngestEnv>;
