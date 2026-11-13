import { describe, expect, it, vi } from 'vitest';
import { processRetailEmail } from './retail-email';
import { faireOrderNumber, RETAIL_INBOX } from '$lib/retail/orders';

function fixture(to: string) {
	const statements: Array<{ sql: string; values: unknown[] }> = [];
	const db = {
		prepare: (sql: string) => {
			const statement = {
				sql,
				values: [] as unknown[],
				bind(...values: unknown[]) {
					this.values = values;
					return this;
				},
				first: async () => null
			};
			statements.push(statement);
			return statement;
		},
		batch: vi.fn(async () => [])
	} as unknown as D1Database;
	const raw = new TextEncoder().encode(
		'From: buyer@example.com\r\nSubject: Faire order #AB12345\r\nMessage-ID: <one@example.com>\r\nContent-Type: text/plain\r\n\r\nOrder number: AB12345\r\nTwo mugs'
	);
	const message = {
		to,
		from: 'buyer@example.com',
		rawSize: raw.length,
		raw: new Blob([raw]).stream(),
		setReject: vi.fn()
	} as unknown as ForwardableEmailMessage;
	return { db, message, statements };
}
describe('retail email intake', () => {
	it('leaves existing project email routing alone', async () => {
		const { db, message, statements } = fixture('projects+abc@example.com');
		expect(await processRetailEmail(message, db)).toBe(false);
		expect(statements).toHaveLength(0);
	});
	it('leaves the retired plus-address format alone', async () => {
		const { db, message } = fixture(RETAIL_INBOX.replace('@', '+wrong@'));
		expect(await processRetailEmail(message, db)).toBe(false);
		expect(db.batch).not.toHaveBeenCalled();
	});
	it('atomically creates a deduplicated order and five steps', async () => {
		const { db, message, statements } = fixture(RETAIL_INBOX);
		await processRetailEmail(message, db);
		expect(db.batch).toHaveBeenCalledOnce();
		expect(statements[0].sql).toContain('INSERT OR IGNORE');
		expect(statements[0].values[1]).toBe('faire:AB12345');
		expect(statements.slice(1)).toHaveLength(5);
		expect(statements.slice(1).every((statement) => statement.values[1] === 'faire:AB12345')).toBe(
			true
		);
	});
	it('does not guess an order number from ordinary prose', () => {
		expect(faireOrderNumber('Your order has shipped')).toBe('');
		expect(faireOrderNumber('Order number: ab12345')).toBe('AB12345');
	});
});
