import { parseFaireOrder, type ParsedFaireOrder } from '$lib/retail/orders';

export type GeneratedReceiptFile = {
	filename: string;
	mimeType: 'application/pdf';
	content: ArrayBuffer;
};

const MINIMUM_QUICKBOOKS_ATTACHMENT_BYTES = 47 * 1024;

function pdfText(value: string): string {
	return value
		.normalize('NFKD')
		.replaceAll(/[^\x20-\x7e]/gu, '?')
		.replaceAll('\\', '\\\\')
		.replaceAll('(', '\\(')
		.replaceAll(')', '\\)');
}

function wrap(value: string, maxLength = 86): string[] {
	const words = value.trim().split(/\s+/u).filter(Boolean);
	if (!words.length) return [''];
	const lines: string[] = [];
	let line = '';
	for (const word of words) {
		if (!line || `${line} ${word}`.length <= maxLength) line = line ? `${line} ${word}` : word;
		else {
			lines.push(line);
			line = word;
		}
	}
	if (line) lines.push(line);
	return lines;
}

function receiptLines(order: ParsedFaireOrder, receivedAt: string): string[] {
	const date = new Date(receivedAt);
	const dateLabel = Number.isNaN(date.getTime()) ? receivedAt : date.toISOString().slice(0, 10);
	const itemLabel = order.itemCount
		? `${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`
		: '';
	return [
		'FAIRE ORDER RECEIPT',
		'',
		`Vendor: ${order.brand || 'Faire seller'}`,
		`Order number: ${order.orderNumber}`,
		`Receipt date: ${dateLabel}`,
		itemLabel
			? `Order summary: ${itemLabel}${order.total ? ` · ${order.total}` : ''}`
			: `Total: ${order.total}`,
		'',
		'Products',
		...order.products.flatMap((product) =>
			wrap(`${product.name} — ${product.unit_price} × ${product.quantity}`)
		),
		'',
		`Total: ${order.total}`,
		'',
		'Generated from the Faire order confirmation received by Queerlective CoLab.'
	];
}

function receiptPdf(lines: string[]): ArrayBuffer {
	const perPage = 52;
	const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / perPage)) }, (_, index) =>
		lines.slice(index * perPage, (index + 1) * perPage)
	);
	const fontObject = 3 + pages.length * 2;
	const objects = new Map<number, string>();
	objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
	objects.set(
		2,
		`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] >>`
	);
	for (const [index, page] of pages.entries()) {
		const pageObject = 3 + index * 2;
		const contentsObject = pageObject + 1;
		const body = [
			'BT',
			'/F1 11 Tf',
			'72 756 Td',
			'13 TL',
			...page.flatMap((line) => [`(${pdfText(line)}) Tj`, 'T*']),
			'ET'
		].join('\n');
		objects.set(
			pageObject,
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentsObject} 0 R >>`
		);
		objects.set(
			contentsObject,
			`<< /Length ${new TextEncoder().encode(body).byteLength} >>\nstream\n${body}\nendstream`
		);
	}
	objects.set(fontObject, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

	const encoder = new TextEncoder();
	const header = '%PDF-1.4\n% Queerlective CoLab\n';
	let body = '';
	const offsets = new Map<number, number>();
	for (const [id, object] of [...objects.entries()].sort(([left], [right]) => left - right)) {
		offsets.set(id, encoder.encode(header + body).byteLength);
		body += `${id} 0 obj\n${object}\nendobj\n`;
	}
	const xref = () => {
		const start = encoder.encode(header + body).byteLength;
		const rows = [...objects.keys()]
			.sort((left, right) => left - right)
			.map((id) => `${String(offsets.get(id)).padStart(10, '0')} 00000 n `)
			.join('\n');
		return `xref\n0 ${objects.size + 1}\n0000000000 65535 f \n${rows}\ntrailer\n<< /Size ${objects.size + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
	};
	let pdf = header + body + xref();
	if (encoder.encode(pdf).byteLength < MINIMUM_QUICKBOOKS_ATTACHMENT_BYTES) {
		body += `% ${'P'.repeat(MINIMUM_QUICKBOOKS_ATTACHMENT_BYTES - encoder.encode(pdf).byteLength)}\n`;
		pdf = header + body + xref();
	}
	return encoder.encode(pdf).buffer;
}

export function faireReceiptFile(input: {
	text: string;
	html?: string | null;
	receivedAt: string;
}): GeneratedReceiptFile | null {
	const order = parseFaireOrder({ text: input.text, html: input.html });
	if (!order.orderNumber || !order.total) return null;
	return {
		filename: `faire-order-${order.orderNumber}.pdf`,
		mimeType: 'application/pdf',
		content: receiptPdf(receiptLines(order, input.receivedAt))
	};
}
