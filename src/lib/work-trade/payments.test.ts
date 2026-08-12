import type { WorkTradeDiscount } from '$lib/server/db/work-trade-repository';
import { describe, expect, it } from 'vitest';
import { mergeMembershipTransactions, workTradePayment } from './payments';

const discount: WorkTradeDiscount = {
	memberId: 'member-1',
	memberName: 'Alex Morgan',
	month: '2026-07',
	membershipType: 'CoLab Member',
	membershipPrice: 20,
	activityCount: 1,
	activities: [],
	workSummary: 'One activity',
	eligibleDiscount: 10,
	approvedDiscount: 10,
	status: 'opted_in',
	reviewedAt: '2026-08-01T10:00:00.000Z',
	memberOptedInAt: '2026-08-03T12:00:00.000Z',
	shopifyUpdatedAt: '',
	updatedAt: '2026-08-03T12:00:00.000Z'
};

describe('work-trade payment history', () => {
	it('records an opted-in discount as a negative membership credit', () => {
		expect(workTradePayment(discount, 'alex@example.com')).toEqual({
			id: 'work-trade:member-1:2026-07',
			name: 'Work-trade membership credit',
			amount: -10,
			details: 'Work-trade discount opted in for July 2026',
			email: 'alex@example.com',
			orderDate: '2026-08-03T12:00:00.000Z'
		});
	});

	it('merges credits with Shopify payments in date order without duplicates', () => {
		const merged = mergeMembershipTransactions(
			[
				{
					id: 'shopify-1',
					name: 'Membership',
					amount: 20,
					details: 'CoLab Membership Subscription',
					email: 'alex@example.com',
					orderDate: '2026-08-02'
				}
			],
			[discount],
			'alex@example.com'
		);
		expect(merged.map(({ id }) => id)).toEqual(['work-trade:member-1:2026-07', 'shopify-1']);
	});
});
