import { RETAIL_STEPS, type RetailOrder } from '$lib/retail/orders';
import type { Database } from './types';

export class RetailRepository {
	constructor(private readonly db: Database) {}
	async inbox(): Promise<string> {
		return (
			(
				await this.db
					.prepare('SELECT token FROM retail_inbox WHERE id = 1')
					.first<{ token: string }>()
			)?.token ?? ''
		);
	}
	async enableInbox(): Promise<string> {
		await this.db
			.prepare('INSERT OR IGNORE INTO retail_inbox (id, token) VALUES (1, ?1)')
			.bind(crypto.randomUUID())
			.run();
		return this.inbox();
	}
	async list(): Promise<RetailOrder[]> {
		const [orders, steps] = await Promise.all([
			this.db
				.prepare(
					'SELECT id, title, order_number, notes, created_at FROM retail_orders ORDER BY created_at DESC'
				)
				.all<Omit<RetailOrder, 'steps'>>(),
			this.db
				.prepare('SELECT order_id, step_id, completed_at FROM retail_order_steps')
				.all<{ order_id: string; step_id: string; completed_at: string }>()
		]);
		return orders.results.map((order) => ({
			...order,
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
	}): Promise<void> {
		const key = input.orderNumber
			? `faire:${input.orderNumber.toUpperCase()}`
			: `email:${input.messageId || crypto.randomUUID()}`;
		await this.db.batch([
			this.db
				.prepare(
					'INSERT OR IGNORE INTO retail_orders (id, dedupe_key, title, order_number, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
				)
				.bind(
					crypto.randomUUID(),
					key,
					input.title,
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
		]);
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
}
