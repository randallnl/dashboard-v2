import { textPdf, type GeneratedReceiptFile, wrapPdfText } from './faire-receipt';

const MAX_EMAIL_COPY_CHARACTERS = 100_000;

function plainHtml(html: string): string {
	return html
		.replace(/<\/(?:p|div|h[1-6]|li|tr|br)\s*>/giu, '\n')
		.replace(/<[^>]*>/gu, ' ')
		.replaceAll('&nbsp;', ' ')
		.replaceAll('&amp;', '&')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'");
}

function emailBody(text: string, html: string | null | undefined): string {
	const body = (text.trim() || plainHtml(html || '').trim() || '(No message body)').slice(
		0,
		MAX_EMAIL_COPY_CHARACTERS
	);
	return body.replaceAll(/\r\n?/gu, '\n');
}

function filenameDate(receivedAt: string): string {
	const date = new Date(receivedAt);
	if (Number.isNaN(date.getTime())) return 'email';
	return date.toISOString().replaceAll(/[:.]/gu, '-');
}

export function receiptEmailCopyFile(input: {
	from: string;
	to: string;
	subject: string;
	receivedAt: string;
	text: string;
	html?: string | null;
}): GeneratedReceiptFile {
	const body = emailBody(input.text, input.html);
	const lines = [
		'RECEIPT EMAIL COPY',
		'',
		...wrapPdfText(`Received: ${input.receivedAt}`),
		...wrapPdfText(`From: ${input.from || '(unknown sender)'}`),
		...wrapPdfText(`To: ${input.to || '(unknown recipient)'}`),
		...wrapPdfText(`Subject: ${input.subject || '(no subject)'}`),
		'',
		'Message',
		...body.split('\n').flatMap((line) => wrapPdfText(line))
	];
	return {
		filename: `receipt-email-${filenameDate(input.receivedAt)}.pdf`,
		mimeType: 'application/pdf',
		content: textPdf(lines)
	};
}
