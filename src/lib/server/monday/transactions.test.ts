import { describe, expect, it } from 'vitest';
import { mapTransaction, openOrdersForEmail, paymentsForEmail } from './transactions';

const transactions = [
	{
		id: 'payment',
		name: 'Membership',
		amount: 50,
		details: 'CoLab Membership Subscription — July',
		email: 'member@example.com',
		orderDate: '2026-07-02',
		fulfillmentStatus: 'Unfulfilled'
	},
	{
		id: 'order',
		name: 'Print order',
		amount: 12,
		details: 'Two risograph prints',
		email: 'member@example.com',
		orderDate: '2026-07-03',
		fulfillmentStatus: 'Unfulfilled'
	},
	{
		id: 'other',
		name: 'Other member order',
		amount: 20,
		details: 'Artwork',
		email: 'other@example.com',
		orderDate: '2026-07-04',
		fulfillmentStatus: 'Unfulfilled'
	},
	{
		id: 'fulfilled',
		name: 'Completed order',
		amount: 8,
		details: 'Sticker',
		email: 'member@example.com',
		orderDate: '2026-07-01',
		fulfillmentStatus: 'Fulfilled'
	}
];

describe('transaction filters', () => {
	it('matches subscription payments using a normalized email', () => {
		expect(paymentsForEmail(transactions, ' MEMBER@Example.COM ')).toHaveLength(1);
		expect(paymentsForEmail(transactions, 'member@example.com')[0]?.id).toBe('payment');
	});

	it('returns only unfulfilled, non-subscription orders for the member', () => {
		expect(openOrdersForEmail(transactions, 'member@example.com').map((order) => order.id)).toEqual(
			['order']
		);
	});

	it('maps currency-like amounts without returning NaN', () => {
		expect(
			mapTransaction({
				id: '1',
				name: 'Payment',
				column_values: [
					{ id: 'numeric_mm2fgrdz', text: '$1,250.50', value: null },
					{ id: 'text_mm2f5770', text: ' MEMBER@Example.com ', value: null }
				]
			})
		).toMatchObject({ amount: 1250.5, email: 'member@example.com' });
	});
});
