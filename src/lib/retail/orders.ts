export const RETAIL_INBOX = 'retail@nhsolidarityecosystem.com';
export const RETAIL_STEPS = [
	{ id: 'received', label: 'Receive shipment and check quantities / damage' },
	{ id: 'shopify', label: 'Add to Shopify inventory' },
	{ id: 'totally-tea', label: 'Add to Totally Tea inventory' },
	{ id: 'labels', label: 'Price and label products' },
	{ id: 'display', label: 'Add to Totally Tea retail display' }
] as const;

export type RetailProduct = {
	name: string;
	quantity: number;
	unit_price: string;
	thumbnail_url: string;
};

export type RetailWorkInstruction = {
	id: number;
	stepId: string;
	url: string;
	label: string;
	updatedBy: string;
	updatedAt: string;
};

export type RetailOrder = {
	id: string;
	title: string;
	brand: string;
	item_count: number;
	total: string;
	order_number: string;
	notes: string;
	created_at: string;
	products: RetailProduct[];
	steps: Record<string, string>;
};

export type ParsedFaireOrder = {
	orderNumber: string;
	brand: string;
	itemCount: number;
	total: string;
	products: RetailProduct[];
};

const MAX_PRODUCTS = 100;

function decodeEntities(value: string): string {
	return value
		.replaceAll('&amp;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>');
}

function normalizedName(value: string): string {
	return decodeEntities(value)
		.toLocaleLowerCase('en-US')
		.replaceAll(/[^a-z0-9]+/giu, ' ')
		.trim();
}

function textLines(value: string): string[] {
	return value
		.replaceAll(/\r\n?/gu, '\n')
		.split('\n')
		.map((line) => decodeEntities(line).replaceAll(/\s+/gu, ' ').trim())
		.filter(Boolean);
}

function orderSummaryCode(lines: string[]): string {
	const summary = lines.findIndex((line) => /^order summary$/iu.test(line));
	if (summary < 0) return '';
	for (const line of lines.slice(summary + 1, summary + 5)) {
		if (/^[a-z0-9][a-z0-9-]{5,39}$/iu.test(line)) return line.toUpperCase();
	}
	return '';
}

function price(value: string): string {
	const match = value.match(/^(\$[\d,]+(?:\.\d{2})?(?:\s+(?:WSP|USD))?)$/iu);
	return match?.[1] ?? '';
}

function productThumbnail(html: string, name: string): string {
	const target = normalizedName(name);
	if (!target || !html) return '';
	for (const tag of html.matchAll(/<img\b[^>]*>/giu)) {
		const alt = htmlAttribute(tag[0], 'alt');
		const source = safeThumbnailUrl(htmlAttribute(tag[0], 'src'));
		if (!source || !alt) continue;
		const candidate = normalizedName(alt);
		if (candidate === target || (candidate.length > 8 && candidate.includes(target))) return source;
	}
	return '';
}

function htmlAttribute(tag: string, name: string): string {
	const match = tag.match(
		new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu')
	);
	return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
}

function safeThumbnailUrl(value: string): string {
	if (!value || value.length > 2_000) return '';
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || url.username || url.password) return '';
		for (const key of url.searchParams.keys()) {
			if (/^(?:email|token|quicklogin|oet|brandordertoken)$/iu.test(key)) return '';
		}
		return url.href;
	} catch {
		return '';
	}
}

function productLines(lines: string[], start: number, end: number): RetailProduct[] {
	const products = new Map<string, RetailProduct>();
	for (let index = start; index < end; index += 1) {
		const quantity = Number(lines[index].match(/^(?:qty|quantity)\s*:\s*(\d+)$/iu)?.[1]);
		if (!Number.isInteger(quantity) || quantity < 1) continue;
		const unitPrice = price(lines[index - 1] ?? '');
		const name = (lines[index - 2] ?? '').slice(0, 300);
		if (!unitPrice || !name || /^(?:free shipping|subtotal|tax|total)$/iu.test(name)) continue;
		const key = `${normalizedName(name)}\u0000${unitPrice}`;
		const existing = products.get(key);
		if (existing) existing.quantity += quantity;
		else if (products.size < MAX_PRODUCTS) {
			products.set(key, { name, quantity, unit_price: unitPrice, thumbnail_url: '' });
		}
	}
	return [...products.values()];
}

export function parseFaireOrder(input: { text: string; html?: string | null }): ParsedFaireOrder {
	const lines = textLines(input.text);
	const summary = lines.findIndex((line) => /^order summary$/iu.test(line));
	if (summary < 0) {
		return {
			orderNumber: faireOrderNumber(input.text),
			brand: '',
			itemCount: 0,
			total: '',
			products: []
		};
	}
	const summaryEnd = lines.findIndex(
		(line, index) =>
			index > summary && /^(?:view all products|subtotal|payment terms|ideas for you)$/iu.test(line)
	);
	const end = summaryEnd > summary ? summaryEnd : lines.length;
	const orderNumber = faireOrderNumber(input.text);
	const itemsIndex = lines.findIndex(
		(line, index) => index > summary && index < end && /^(\d+)\s+items?\s*[·•]\s*\$/u.test(line)
	);
	const itemMatch =
		itemsIndex >= 0
			? lines[itemsIndex].match(/^(\d+)\s+items?\s*[·•]\s*(\$[\d,]+(?:\.\d{2})?)/u)
			: null;
	const numberIndex = lines.findIndex((line, index) => index > summary && line === orderNumber);
	const brand =
		itemsIndex > 0
			? (lines
					.slice(Math.max(summary + 1, numberIndex + 1), itemsIndex)
					.find((line) => line.length <= 200) ?? '')
			: '';
	const products = productLines(lines, itemsIndex >= 0 ? itemsIndex + 1 : summary + 1, end);
	for (const product of products)
		product.thumbnail_url = productThumbnail(input.html ?? '', product.name);
	return {
		orderNumber,
		brand,
		itemCount: Number(itemMatch?.[1] ?? 0),
		total: itemMatch?.[2] ?? '',
		products
	};
}

export function savedFaireEmailText(value: string): string {
	return value
		.replaceAll(/\bhttps?:\/\/[^\s<>\])}]+/giu, '[link removed]')
		.replaceAll(/\n{3,}/gu, '\n\n')
		.trim();
}

export function faireOrderNumber(text: string): string {
	return (
		text
			.match(/\border\s*(?:number|no\.?|#|:)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,40})\b/iu)?.[1]
			?.toUpperCase() ?? orderSummaryCode(textLines(text))
	);
}
