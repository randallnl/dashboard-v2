import type { Database } from './types';

export type ShopifyMarketSale = {
	id: number;
	saleDate: string;
	totalSales: number;
	cashSales: number;
	cardSales: number;
	otherSales: number;
	projectSource: string;
	projectId: string;
	projectTitle: string;
	cashDepositedAt: string;
	cashDepositedBy: string;
	sourceSubject: string;
	sourceReceivedAt: string;
};

type SaleRow = {
	id: number;
	sale_date: string;
	total_sales: number;
	cash_sales: number;
	card_sales: number;
	other_sales: number;
	project_source: string;
	project_id: string;
	project_title: string;
	cash_deposited_at: string;
	cash_deposited_by: string;
	source_subject: string;
	source_received_at: string;
};

function amount(value: number): number {
	return Number.isFinite(value) ? value : 0;
}

function saleFromRow(row: SaleRow): ShopifyMarketSale {
	return {
		id: row.id,
		saleDate: row.sale_date,
		totalSales: amount(row.total_sales),
		cashSales: amount(row.cash_sales),
		cardSales: amount(row.card_sales),
		otherSales: amount(row.other_sales),
		projectSource: row.project_source,
		projectId: row.project_id,
		projectTitle: row.project_title,
		cashDepositedAt: row.cash_deposited_at,
		cashDepositedBy: row.cash_deposited_by,
		sourceSubject: row.source_subject,
		sourceReceivedAt: row.source_received_at
	};
}

export class ShopifyMarketSalesRepository {
	constructor(private readonly db: Database) {}

	async startIngest(input: {
		sourceMessageId: string;
		sourceSender: string;
		sourceSubject: string;
		receivedAt: string;
	}): Promise<'new' | 'processing' | 'complete' | 'failed'> {
		const existing = await this.db
			.prepare('SELECT status FROM shopify_market_sales_ingest WHERE source_message_id = ?1')
			.bind(input.sourceMessageId)
			.first<{ status: 'processing' | 'complete' | 'failed' }>();
		if (existing) return existing.status;
		await this.db
			.prepare(
				`INSERT OR IGNORE INTO shopify_market_sales_ingest
				(source_message_id, source_sender, source_subject, received_at) VALUES (?1, ?2, ?3, ?4)`
			)
			.bind(input.sourceMessageId, input.sourceSender, input.sourceSubject, input.receivedAt)
			.run();
		return 'new';
	}

	async save(input: {
		sourceMessageId: string;
		saleDate: string;
		totalSales: number;
		cashSales: number;
		cardSales: number;
		otherSales: number;
		sourceSubject: string;
		sourceReceivedAt: string;
	}): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO shopify_market_sales (
					source_message_id, sale_date, total_sales, cash_sales, card_sales, other_sales,
					source_subject, source_received_at, archived_at, created_at, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?8, ?8)
				ON CONFLICT(source_message_id) DO UPDATE SET
					sale_date = excluded.sale_date, total_sales = excluded.total_sales,
					cash_sales = excluded.cash_sales, card_sales = excluded.card_sales,
					other_sales = excluded.other_sales, source_subject = excluded.source_subject,
					source_received_at = excluded.source_received_at,
					archived_at = excluded.archived_at, updated_at = excluded.updated_at`
			)
			.bind(
				input.sourceMessageId,
				input.saleDate,
				amount(input.totalSales),
				amount(input.cashSales),
				amount(input.cardSales),
				amount(input.otherSales),
				input.sourceSubject,
				input.sourceReceivedAt,
				''
			)
			.run();
	}

	async completeIngest(sourceMessageId: string, now: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE shopify_market_sales_ingest
				 SET status = 'complete', completed_at = ?2, last_error = '' WHERE source_message_id = ?1`
			)
			.bind(sourceMessageId, now)
			.run();
	}

	async failIngest(sourceMessageId: string, message: string, now: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE shopify_market_sales_ingest
				 SET status = 'failed', completed_at = ?2, last_error = ?3 WHERE source_message_id = ?1`
			)
			.bind(sourceMessageId, now, message.slice(0, 500))
			.run();
	}

	async list(limit = 7): Promise<ShopifyMarketSale[]> {
		const rows = await this.db
			.prepare(
				`SELECT id, sale_date, total_sales, cash_sales, card_sales, other_sales, project_source,
					project_id, project_title, cash_deposited_at, cash_deposited_by, source_subject,
					source_received_at FROM shopify_market_sales
					ORDER BY sale_date DESC, id DESC LIMIT ?1`
			)
			.bind(Math.min(Math.max(limit, 1), 7))
			.all<SaleRow>();
		return rows.results.map(saleFromRow);
	}

	async assignProject(input: {
		id: number;
		projectSource: string;
		projectId: string;
		projectTitle: string;
		now: string;
	}): Promise<void> {
		await this.db
			.prepare(
				`UPDATE shopify_market_sales SET project_source = ?2, project_id = ?3,
				 project_title = ?4, updated_at = ?5 WHERE id = ?1`
			)
			.bind(input.id, input.projectSource, input.projectId, input.projectTitle, input.now)
			.run();
	}

	async setCashDeposited(input: {
		id: number;
		memberId: string;
		now: string;
		deposited: boolean;
	}): Promise<void> {
		await this.db
			.prepare(
				`UPDATE shopify_market_sales SET cash_deposited_at = ?2, cash_deposited_by = ?3,
				 updated_at = ?4 WHERE id = ?1`
			)
			.bind(
				input.id,
				input.deposited ? input.now : '',
				input.deposited ? input.memberId : '',
				input.now
			)
			.run();
	}
}
