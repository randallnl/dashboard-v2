import { describe, expect, it, vi } from 'vitest';
import { processRetailEmail } from './retail-email';
import { faireOrderNumber, RETAIL_INBOX } from '$lib/retail/orders';

function fixture(to: string, body = 'Order number: AB12345\r\nTwo mugs') {
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
		`From: buyer@example.com\r\nSubject: Faire order #AB12345\r\nMessage-ID: <one@example.com>\r\nContent-Type: text/plain\r\n\r\n${body}`
	);
	const message = {
		to,
		from: 'buyer@example.com',
		rawSize: raw.length,
		raw: new Blob([raw]).stream(),
		setReject: vi.fn()
	} as unknown as ForwardableEmailMessage;
	const email = { send: vi.fn(async () => ({ messageId: 'sent-message' })) };
	const env = {
		DB: db,
		EMAIL: email,
		RECEIPT_INBOX_EMAIL: 'receipts@nhsolidarityecosystem.com',
		RETAIL_RECEIPT_FROM_EMAIL: 'dashboard@nhciviccommons.com'
	};
	return { db, email, env, message, statements };
}
describe('retail email intake', () => {
	it('leaves existing project email routing alone', async () => {
		const { env, message, statements } = fixture('projects+abc@example.com');
		expect(await processRetailEmail(message, env)).toBe(false);
		expect(statements).toHaveLength(0);
	});
	it('leaves the retired plus-address format alone', async () => {
		const { env, message } = fixture(RETAIL_INBOX.replace('@', '+wrong@'));
		expect(await processRetailEmail(message, env)).toBe(false);
		expect(env.DB.batch).not.toHaveBeenCalled();
	});
	it('atomically creates a deduplicated order and five steps', async () => {
		const { env, message, statements } = fixture(RETAIL_INBOX);
		await processRetailEmail(message, env);
		expect(env.DB.batch).toHaveBeenCalledOnce();
		expect(statements[0].sql).toContain('INSERT OR IGNORE');
		expect(statements[0].values[1]).toBe('faire:AB12345');
		expect(statements.slice(1, 6)).toHaveLength(5);
		expect(
			statements.slice(1, 6).every((statement) => statement.values[1] === 'faire:AB12345')
		).toBe(true);
		expect(statements[6].sql).toContain('UPDATE retail_orders');
	});
	it('sends a recognized Faire order through the receipts inbox', async () => {
		const { email, env, message } = fixture(
			RETAIL_INBOX,
			'Order summary\r\nVDUWADJNM8\r\nCamilla Watson Art\r\n23 items · $150.00\r\nFrog Wizard Enamel Pin\r\n$24.00\r\nQty: 3\r\nView all products'
		);
		await processRetailEmail(message, env);
		expect(email.send).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'receipts@nhsolidarityecosystem.com',
				subject: 'Faire receipt VDUWADJNM8 — Camilla Watson Art',
				headers: { 'X-Queerlective-Retail-Receipt': 'VDUWADJNM8' }
			})
		);
	});
	it('does not guess an order number from ordinary prose', () => {
		expect(faireOrderNumber('Your order has shipped')).toBe('');
		expect(faireOrderNumber('Order number: ab12345')).toBe('AB12345');
	});
});
