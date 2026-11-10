import { FinanceReconciliationRepository, isFinanceAccountKey } from '$lib/server/db';
import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/u;
const MAX_STATEMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['application/pdf']);
const ALLOWED_EXTENSIONS = /\.pdf$/iu;

type DriveUploadResult = {
	file: { id: string; name: string; url: string };
};

function validMonth(value: FormDataEntryValue | null): string {
	const month = typeof value === 'string' ? value.trim() : '';
	if (!MONTH.test(month)) error(400, 'Choose a valid reconciliation month.');
	return month;
}

function validStatement(file: FormDataEntryValue | null): File {
	if (!(file instanceof File) || !file.size) error(400, 'Choose a statement file to upload.');
	if (file.size > MAX_STATEMENT_BYTES) error(413, 'Statements must be 20 MB or smaller.');
	if (!ALLOWED_MIME_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.test(file.name)) {
		error(400, 'Upload a PDF statement.');
	}
	return file;
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	requireAdmin(context);
	const form = await request.formData();
	const month = validMonth(form.get('month'));
	const accountKey =
		typeof form.get('accountKey') === 'string' ? String(form.get('accountKey')).trim() : '';
	if (!isFinanceAccountKey(accountKey)) error(400, 'Choose a valid account.');
	const file = validStatement(form.get('statement'));

	const driveForm = new FormData();
	driveForm.set('month', month);
	driveForm.set('accountKey', accountKey);
	driveForm.set('statement', file, file.name);
	const driveResponse = await env!.FINANCE_DRIVE.fetch(
		new Request('https://finance-drive.internal/finance-statements', {
			method: 'POST',
			body: driveForm
		})
	);
	const drivePayload = (await driveResponse.json().catch(() => null)) as DriveUploadResult & {
		message?: string;
	};
	if (!driveResponse.ok || !drivePayload?.file?.id || !drivePayload.file.name) {
		error(502, drivePayload?.message || 'The Finance folder could not accept that statement.');
	}

	const now = new Date().toISOString();
	let quickbooksForwardedAt = '';
	let quickBooksMessage =
		'QuickBooks receipt forwarding is not configured yet. This item will remain outstanding.';
	const quickBooksRecipient = env!.QUICKBOOKS_RECEIPT_EMAIL?.trim();
	if (quickBooksRecipient) {
		try {
			const sent = await env!.EMAIL.send({
				to: quickBooksRecipient,
				from: env!.LOGIN_FROM_EMAIL,
				subject: `Statement: ${month} — ${drivePayload.file.name}`,
				text: `Statement attached for QuickBooks processing. Stored in the CoLab Finance folder: ${drivePayload.file.url}`,
				html: `<p>Statement attached for QuickBooks processing.</p><p>Stored in the <a href="${drivePayload.file.url}">CoLab Finance folder</a>.</p>`,
				attachments: [
					{
						content: await file.arrayBuffer(),
						filename: drivePayload.file.name,
						type: file.type || 'application/octet-stream',
						disposition: 'attachment'
					}
				]
			});
			if (sent.messageId) {
				quickbooksForwardedAt = now;
				quickBooksMessage = 'Forwarded to the QuickBooks receipt inbox.';
			}
		} catch (cause) {
			quickBooksMessage = `Saved to Drive, but QuickBooks forwarding failed: ${
				cause instanceof Error ? cause.message : 'unknown email error'
			}`;
		}
	}

	const repository = new FinanceReconciliationRepository(env!.DB);
	await repository.ensureMonth(month);
	await repository.recordStatement(month, accountKey, {
		fileId: drivePayload.file.id,
		fileName: drivePayload.file.name,
		uploadedBy: context.viewer.id,
		quickbooksForwardedAt,
		now
	});
	return json({
		month,
		tasks: await repository.list(month),
		quickBooksConfigured: Boolean(quickBooksRecipient),
		quickBooksMessage,
		message: quickbooksForwardedAt
			? 'Statement saved to Drive and forwarded to QuickBooks.'
			: 'Statement saved to the Finance folder. QuickBooks forwarding still needs attention.'
	});
};
