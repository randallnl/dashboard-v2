import PostalMime from 'postal-mime';
import {
	RETAIL_INBOX,
	faireOrderNumber,
	parseFaireOrder,
	savedFaireEmailText
} from '$lib/retail/orders';
import { RetailRepository } from '$lib/server/db/retail-repository';
import { receiptEmailCopyFile } from '$lib/server/receipts/email-copy';

type RetailEmailEnv = {
	DB: D1Database;
	EMAIL: SendEmail;
	RECEIPT_INBOX_EMAIL: string;
	RETAIL_RECEIPT_FROM_EMAIL: string;
};

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function receiptSummary(input: {
	orderNumber: string;
	brand: string;
	itemCount: number;
	total: string;
	products: Array<{ name: string; unit_price: string; quantity: number }>;
}): string {
	const itemCount =
		input.itemCount || input.products.reduce((sum, product) => sum + product.quantity, 0);
	const itemLabel = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
	return [
		'Faire order receipt',
		'',
		'Order summary',
		input.orderNumber,
		input.brand || 'Faire seller',
		`${itemLabel} · ${input.total}`,
		...input.products.flatMap((product) => [
			product.name,
			product.unit_price,
			`Qty: ${product.quantity}`
		]),
		'View all products',
		'Subtotal',
		input.total
	].join('\n');
}

export async function processRetailEmail(
	message: ForwardableEmailMessage,
	env: RetailEmailEnv
): Promise<boolean> {
	const recipient = message.to.trim().toLowerCase();
	if (recipient !== RETAIL_INBOX) return false;
	if (message.rawSize > 5 * 1024 * 1024) {
		message.setReject('Retail emails must be smaller than 5 MB.');
		return true;
	}
	const raw = await new Response(message.raw).arrayBuffer();
	const parsed = await PostalMime.parse(raw);
	const subject = parsed.subject?.trim() || 'Faire order — review details';
	const text = parsed.text || (parsed.html || '').replace(/<[^>]*>/gu, ' ');
	const details = parseFaireOrder({ text, html: parsed.html });
	const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
	await new RetailRepository(env.DB).create({
		title: (details.brand || subject).slice(0, 200),
		orderNumber: details.orderNumber || faireOrderNumber(`${subject}\n${text}`),
		notes: savedFaireEmailText(`Forwarded by: ${message.from}\n\n${text}`).slice(0, 20000),
		messageId: parsed.messageId || hash,
		brand: details.brand,
		itemCount: details.itemCount,
		total: details.total,
		products: details.products,
		enrich: true
	});
	if (details.orderNumber && details.total) {
		const summary = receiptSummary(details);
		const originalEmailPdf = receiptEmailCopyFile({
			from: message.from,
			to: message.to,
			subject,
			receivedAt: new Date().toISOString(),
			text: parsed.text || '',
			html: parsed.html
		});
		await env.EMAIL.send({
			to: env.RECEIPT_INBOX_EMAIL,
			from: env.RETAIL_RECEIPT_FROM_EMAIL,
			subject: `Faire receipt ${details.orderNumber} — ${details.brand || 'order'}`,
			text: summary,
			html: `<pre>${escapeHtml(summary)}</pre>`,
			headers: {
				'X-Queerlective-Retail-Receipt': details.orderNumber,
				'X-Queerlective-Original-Email-PDF': '1'
			},
			attachments: [
				{
					content: originalEmailPdf.content,
					filename: originalEmailPdf.filename,
					type: originalEmailPdf.mimeType,
					disposition: 'attachment'
				}
			]
		});
	}
	return true;
}
