import type { WorkTradeDiscount } from '$lib/server/db/work-trade-repository';
import type { Payment } from '$lib/types/domain';

function monthLabel(month: string): string {
	const parsed = new Date(`${month}-01T12:00:00Z`);
	return Number.isNaN(parsed.getTime())
		? month
		: new Intl.DateTimeFormat('en-US', {
				month: 'long',
				year: 'numeric',
				timeZone: 'UTC'
			}).format(parsed);
}

export function workTradePayment(discount: WorkTradeDiscount, email: string): Payment {
	return {
		id: `work-trade:${discount.memberId}:${discount.month}`,
		name: 'Work-trade membership credit',
		amount: -Math.abs(discount.approvedDiscount),
		details: `Work-trade discount opted in for ${monthLabel(discount.month)}`,
		email,
		orderDate: discount.memberOptedInAt || `${discount.month}-01`
	};
}

export function mergeMembershipTransactions(
	payments: Payment[],
	discounts: WorkTradeDiscount[],
	email: string,
	limit = 50
): Payment[] {
	return [...payments, ...discounts.map((discount) => workTradePayment(discount, email))]
		.sort((left, right) => right.orderDate.localeCompare(left.orderDate))
		.slice(0, limit);
}
