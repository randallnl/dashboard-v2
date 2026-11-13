import { RETAIL_STEPS, type RetailOrder, type RetailProduct } from '$lib/retail/orders';
import type { Database } from './types';

type RetailOrderRow = Omit<RetailOrder, 'products' | 'steps'>;
type RetailProductRow = RetailProduct & { order_id: string };

export class RetailRepository {
	constructor(private readonly db: Database) {}
	async list(): Promise<RetailOrder[]> {
		const [orders, steps, products] = await Promise.all([
			this.db
				.prepare(
					'SELECT id, title, brand, item_count, total, order_number, notes, created_at FROM retail_orders ORDER BY created_at DESC'
				)
				.all<RetailOrderRow>(),
			this.db
				.prepare('SELECT order_id, step_id, completed_at FROM retail_order_steps')
				.all<{ order_id: string; step_id: string; completed_at: string }>(),
			this.db
				.prepare(
					'SELECT order_id, name, quantity, unit_price, thumbnail_url FROM retail_order_products ORDER BY order_id, position'
				)
				.all<RetailProductRow>()
		]);
		return orders.results.map((order) => ({
			...order,
			products: products.results
				.filter((product) => product.order_id === order.id)
				.map(({ order_id: _orderId, ...product }) => product),
			steps: Object.fromEntries(
				steps.results
					.filter((step) => step.order_id === order.id)
					.map((step) => [step.step_id, step.completed_at])
			)
		}));
	}
	async create(input: {
		title: string;
		orderNumber: string;
		notes: string;
		messageId?: string;
		brand?: string;
		itemCount?: number;
		total?: string;
		products?: RetailProduct[];
		enrich?: boolean;
	}): Promise<void> {
		const key = input.orderNumber
			? `faire:${input.orderNumber.toUpperCase()}`
			: `email:${input.messageId || crypto.randomUUID()}`;
		const statements = [
			this.db
				.prepare(
					'INSERT OR IGNORE INTO retail_orders (id, dedupe_key, title, brand, item_count, total, order_number, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)'
				)
				.bind(
					crypto.randomUUID(),
					key,
					input.title,
					input.brand ?? '',
					input.itemCount ?? 0,
					input.total ?? '',
					input.orderNumber,
					input.notes,
					new Date().toISOString()
				),
			...RETAIL_STEPS.map((step) =>
				this.db
					.prepare(
						'INSERT OR IGNORE INTO retail_order_steps (order_id, step_id) SELECT id, ?1 FROM retail_orders WHERE dedupe_key = ?2'
					)
					.bind(step.id, key)
			)
		];
		if (input.enrich) {
			statements.push(
				this.db
					.prepare(
						`UPDATE retail_orders
						SET brand = CASE WHEN ?1 <> '' THEN ?1 ELSE brand END,
							item_count = CASE WHEN ?2 > 0 THEN ?2 ELSE item_count END,
							total = CASE WHEN ?3 <> '' THEN ?3 ELSE total END,
							notes = CASE WHEN ?4 <> '' THEN ?4 ELSE notes END
						WHERE dedupe_key = ?5`
					)
					.bind(input.brand ?? '', input.itemCount ?? 0, input.total ?? '', input.notes, key)
			);
		}
		if (input.products?.length) {
			statements.push(
				this.db
					.prepare(
						'DELETE FROM retail_order_products WHERE order_id = (SELECT id FROM retail_orders WHERE dedupe_key = ?1)'
					)
					.bind(key),
				...input.products.slice(0, 100).map((product, position) =>
					this.db
						.prepare(
							`INSERT INTO retail_order_products (order_id, position, name, quantity, unit_price, thumbnail_url)
							SELECT id, ?1, ?2, ?3, ?4, ?5 FROM retail_orders WHERE dedupe_key = ?6`
						)
						.bind(
							position,
							product.name.slice(0, 300),
							product.quantity,
							product.unit_price.slice(0, 40),
							product.thumbnail_url.slice(0, 2000),
							key
						)
				)
			);
		}
		await this.db.batch(statements);
	}
	async setStep(id: string, step: string, complete: boolean, actor: string): Promise<boolean> {
		const result = await this.db
			.prepare(
				'UPDATE retail_order_steps SET completed_at = ?1, completed_by = ?2 WHERE order_id = ?3 AND step_id = ?4'
			)
			.bind(complete ? new Date().toISOString() : '', complete ? actor : '', id, step)
			.run();
		return result.meta.changes > 0;
	}
	async remove(id: string): Promise<boolean> {
		const result = await this.db.prepare('DELETE FROM retail_orders WHERE id = ?1').bind(id).run();
		return result.meta.changes > 0;
	}
}
