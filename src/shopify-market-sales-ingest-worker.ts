import PostalMime from 'postal-mime';
import { ShopifyMarketSalesRepository } from '$lib/server/db/shopify-market-sales-repository';

function base64Url(value: ArrayBuffer): string {
	let binary = '';
	for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function plainText(value: string): string {
	return value
		.replaceAll(/<style[\s\S]*?<\/style>/giu, ' ')
		.replaceAll(/<[^>]+>/gu, ' ')
		.replaceAll(/&nbsp;/giu, ' ')
		.replaceAll(/&amp;/giu, '&')
		.replaceAll(/\s+/gu, ' ')
		.trim();
}

function dollars(value: string): number | null {
	const cleaned = value.replaceAll(/[$,\s]/gu, '');
	const parsed = Number(cleaned);
	return Number.isFinite(parsed) ? parsed : null;
}

function labelledAmount(text: string, labels: string[]): number | null {
	for (const label of labels) {
		const match = text.match(
			new RegExp(`(?:${label})[^$\\d]{0,45}(\\$?\\s*[\\d,]+(?:\\.\\d{2})?)`, 'iu')
		);
		if (match?.[1]) return dollars(match[1]);
	}
	return null;
}

function reportDate(messageDate: string | null, receivedAt: string): string {
	const parsed = messageDate ? new Date(messageDate) : new Date(receivedAt);
	return Number.isNaN(parsed.getTime())
		? receivedAt.slice(0, 10)
		: parsed.toISOString().slice(0, 10);
}

function parseDailySales(text: string): {
	totalSales: number;
	cashSales: number;
	cardSales: number;
	otherSales: number;
} {
	const totalSales =
		labelledAmount(text, ['total\\s+(?:net\\s+)?sales', 'net\\s+sales', 'total']) ?? 0;
	const cashSales = labelledAmount(text, ['cash(?:\\s+payments?|\\s+tender)?']) ?? 0;
	const cardSales =
		labelledAmount(text, [
			'card(?:\\s+payments?|\\s+tender)?',
			'credit\\s+card',
			'shopify\\s+payments'
		]) ?? 0;
	const explicitOther = labelledAmount(text, ['other(?:\\s+payments?|\\s+tender)?']);
	return {
		totalSales,
		cashSales,
		cardSales,
		otherSales: explicitOther ?? Math.max(0, totalSales - cashSales - cardSales)
	};
}

async function processShopifySales(
	message: ForwardableEmailMessage,
	env: ShopifyMarketSalesEnv
): Promise<void> {
	if (message.to.toLowerCase() !== env.SHOPIFY_SALES_INBOX_EMAIL.toLowerCase()) {
		message.setReject('This inbox only accepts Shopify market sales reports.');
		return;
	}
	const raw = await new Response(message.raw).arrayBuffer();
	const parsed = await PostalMime.parse(raw);
	const receivedAt = new Date().toISOString();
	const sourceMessageId =
		message.headers.get('message-id')?.trim() ||
		`hash:${base64Url(await crypto.subtle.digest('SHA-256', raw))}`;
	const sourceSubject = parsed.subject?.trim() || '(no subject)';
	const repository = new ShopifyMarketSalesRepository(env.DB);
	const state = await repository.startIngest({
		sourceMessageId,
		sourceSender: message.from,
		sourceSubject,
		receivedAt
	});
	if (state === 'complete' || state === 'processing') return;

	try {
		const text = [parsed.text, parsed.html ? plainText(parsed.html) : ''].filter(Boolean).join(' ');
		const sales = parseDailySales(text);
		await repository.save({
			sourceMessageId,
			saleDate: reportDate(message.headers.get('date'), receivedAt),
			...sales,
			sourceSubject,
			sourceReceivedAt: receivedAt
		});
		await repository.completeIngest(sourceMessageId, receivedAt);
	} catch (cause) {
		const error = cause instanceof Error ? cause.message : 'Unknown Shopify sales processing error';
		await repository.failIngest(sourceMessageId, error, receivedAt);
		console.error(JSON.stringify({ event: 'shopify_market_sales_failed', sourceMessageId, error }));
	}
}

export default {
	async email(message, env): Promise<void> {
		await processShopifySales(message, env);
	},
	async fetch(): Promise<Response> {
		return new Response('Not found', { status: 404 });
	}
} satisfies ExportedHandler<ShopifyMarketSalesEnv>;
