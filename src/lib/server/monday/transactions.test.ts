import { describe, expect, it } from 'vitest';
import {
	mapTransaction,
	openOrders,
	openOrdersForEmail,
	openOrdersForEmails,
	paymentsForEmail,
	paymentsForEmails
} from './transactions';

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
		id: 'alternate-payment',
		name: 'Membership',
		amount: 45,
		details: 'CoLab Membership Subscription — June',
		email: 'alternate@example.com',
		orderDate: '2026-06-02',
		fulfillmentStatus: 'Fulfilled'
	},
	{
		id: 'alternate-order',
		name: 'Workshop materials',
		amount: 18,
		details: 'Paper and ink',
		email: 'alternate@example.com',
		orderDate: '2026-07-05',
		fulfillmentStatus: ''
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

	it('matches membership payments across primary and alternate emails', () => {
		expect(
			paymentsForEmails(transactions, [
				' MEMBER@example.com ',
				'Alternate@Example.com',
				'alternate@example.com'
			]).map((payment) => payment.id)
		).toEqual(['payment', 'alternate-payment']);
	});

	it('does not match unrelated emails or non-subscription transactions', () => {
		expect(paymentsForEmails(transactions, ['missing@example.com'])).toEqual([]);
	});

	it('returns only unfulfilled, non-subscription orders for the member', () => {
		expect(openOrdersForEmail(transactions, 'member@example.com').map((order) => order.id)).toEqual(
			['order']
		);
	});

	it('matches open orders across alternate emails and blank fulfillment states', () => {
		expect(
			openOrdersForEmails(transactions, ['member@example.com', ' ALTERNATE@example.com ']).map(
				(order) => order.id
			)
		).toEqual(['alternate-order', 'order']);
	});

	it('returns the shared open-order queue across member emails', () => {
		expect(openOrders(transactions).map((order) => order.id)).toEqual([
			'alternate-order',
			'other',
			'order'
		]);
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
