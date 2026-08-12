import type { ScoredWorkActivity } from '$lib/work-trade/scoring';
import type { Database } from './types';

export type WorkTradeStatus =
	'pending_review' | 'approved' | 'opted_in' | 'declined' | 'shopify_updated';

export type WorkTradeDiscount = {
	memberId: string;
	memberName: string;
	month: string;
	membershipType: string;
	membershipPrice: number;
	activityCount: number;
	activities: ScoredWorkActivity[];
	workSummary: string;
	eligibleDiscount: number;
	approvedDiscount: number;
	status: WorkTradeStatus;
	reviewedAt: string;
	memberOptedInAt: string;
	shopifyUpdatedAt: string;
	updatedAt: string;
};

type WorkTradeRow = {
	member_id: string;
	preferred_name?: string;
	month: string;
	membership_type: string;
	membership_price: number;
	activity_count: number;
	activities_json: string;
	work_summary: string;
	eligible_discount: number;
	approved_discount: number;
	status: WorkTradeStatus;
	reviewed_at: string;
	member_opted_in_at: string;
	shopify_updated_at: string;
	updated_at: string;
};

function mapRow(row: WorkTradeRow): WorkTradeDiscount {
	const parsed = JSON.parse(row.activities_json) as Array<
		Partial<ScoredWorkActivity> &
			Pick<
				ScoredWorkActivity,
				| 'id'
				| 'type'
				| 'submitDate'
				| 'description'
				| 'memberId'
				| 'reason'
				| 'needsReview'
				| 'discountPercent'
			>
	>;
	return {
		memberId: row.member_id,
		memberName: row.preferred_name || '',
		month: row.month,
		membershipType: row.membership_type,
		membershipPrice: row.membership_price,
		activityCount: row.activity_count,
		activities: parsed.map((activity) => ({
			...activity,
			discountAmount: Number(activity.discountAmount) || 0,
			discountOverridden: Boolean(activity.discountOverridden)
		})) as ScoredWorkActivity[],
		workSummary: row.work_summary,
		eligibleDiscount: row.eligible_discount,
		approvedDiscount: row.approved_discount,
		status: row.status,
		reviewedAt: row.reviewed_at,
		memberOptedInAt: row.member_opted_in_at,
		shopifyUpdatedAt: row.shopify_updated_at,
		updatedAt: row.updated_at
	};
}

export class WorkTradeRepository {
	constructor(private readonly db: Database) {}

	async upsert(
		input: Omit<
			WorkTradeDiscount,
			| 'memberName'
			| 'approvedDiscount'
			| 'status'
			| 'reviewedAt'
			| 'memberOptedInAt'
			| 'shopifyUpdatedAt'
			| 'updatedAt'
		>,
		now: string
	): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO work_trade_discounts (
			member_id, month, membership_type, membership_price, activity_count,
			activities_json, work_summary, eligible_discount, updated_at
		) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
		ON CONFLICT(member_id, month) DO UPDATE SET
			membership_type = excluded.membership_type,
			membership_price = excluded.membership_price,
			activity_count = excluded.activity_count,
			activities_json = excluded.activities_json,
			work_summary = excluded.work_summary,
			eligible_discount = excluded.eligible_discount,
			updated_at = excluded.updated_at
		WHERE work_trade_discounts.status = 'pending_review'`
			)
			.bind(
				input.memberId,
				input.month,
				input.membershipType,
				input.membershipPrice,
				input.activityCount,
				JSON.stringify(input.activities),
				input.workSummary,
				input.eligibleDiscount,
				now
			)
			.run();
	}

	async find(memberId: string, month: string): Promise<WorkTradeDiscount | null> {
		const row = await this.db
			.prepare(
				`SELECT w.*, m.preferred_name FROM work_trade_discounts w
			LEFT JOIN member_directory m ON m.id = w.member_id
			WHERE w.member_id = ?1 AND w.month = ?2 LIMIT 1`
			)
			.bind(memberId, month)
			.first<WorkTradeRow>();
		return row ? mapRow(row) : null;
	}

	async list(month: string): Promise<WorkTradeDiscount[]> {
		const result = await this.db
			.prepare(
				`SELECT w.*, m.preferred_name FROM work_trade_discounts w
			LEFT JOIN member_directory m ON m.id = w.member_id
			WHERE w.month = ?1 ORDER BY m.preferred_name COLLATE NOCASE`
			)
			.bind(month)
			.all<WorkTradeRow>();
		return result.results.map(mapRow);
	}

	async approve(
		memberId: string,
		month: string,
		reviewerId: string,
		now: string
	): Promise<boolean> {
		const result = await this.db
			.prepare(
				`UPDATE work_trade_discounts SET
			status = 'approved', approved_discount = eligible_discount,
			reviewed_by = ?3, reviewed_at = ?4, updated_at = ?4
			WHERE member_id = ?1 AND month = ?2 AND status = 'pending_review'`
			)
			.bind(memberId, month, reviewerId, now)
			.run();
		return result.meta.changes === 1;
	}

	async overrideActivityDiscount(
		memberId: string,
		month: string,
		activityId: string,
		amount: number,
		now: string
	): Promise<boolean> {
		const discount = await this.find(memberId, month);
		if (!discount || discount.status !== 'pending_review') return false;
		const activityIndex = discount.activities.findIndex((activity) => activity.id === activityId);
		if (activityIndex < 0) return false;
		const maximum = discount.membershipPrice - 10;
		const safeAmount = Math.min(Math.max(Math.round(amount * 100) / 100, 0), maximum);
		const requestedActivities = discount.activities.map((activity, index) =>
			index === activityIndex
				? { ...activity, discountAmount: safeAmount, discountOverridden: true }
				: activity
		);
		let remaining = maximum;
		const allocationOrder = [
			requestedActivities[activityIndex],
			...requestedActivities.filter(
				(activity, index) => index !== activityIndex && activity.discountOverridden
			),
			...requestedActivities.filter(
				(activity, index) => index !== activityIndex && !activity.discountOverridden
			)
		];
		const allocated = new Map<string, number>();
		for (const activity of allocationOrder) {
			const amountForActivity = Math.min(activity.discountAmount, remaining);
			allocated.set(activity.id, amountForActivity);
			remaining = Math.round((remaining - amountForActivity) * 100) / 100;
		}
		const activities = requestedActivities.map((activity) => ({
			...activity,
			discountAmount: allocated.get(activity.id) ?? 0
		}));
		const eligibleDiscount = Math.round((maximum - remaining) * 100) / 100;
		const result = await this.db
			.prepare(
				`UPDATE work_trade_discounts SET
			activities_json = ?4, eligible_discount = ?5, updated_at = ?6
			WHERE member_id = ?1 AND month = ?2 AND status = 'pending_review'
			AND EXISTS (SELECT 1 FROM json_each(activities_json) WHERE json_extract(value, '$.id') = ?3)`
			)
			.bind(memberId, month, activityId, JSON.stringify(activities), eligibleDiscount, now)
			.run();
		return result.meta.changes === 1;
	}

	async decline(
		memberId: string,
		month: string,
		reviewerId: string,
		now: string
	): Promise<boolean> {
		const result = await this.db
			.prepare(
				`UPDATE work_trade_discounts SET
			status = 'declined', approved_discount = 0, reviewed_by = ?3,
			reviewed_at = ?4, updated_at = ?4
			WHERE member_id = ?1 AND month = ?2 AND status = 'pending_review'`
			)
			.bind(memberId, month, reviewerId, now)
			.run();
		return result.meta.changes === 1;
	}

	async optIn(memberId: string, month: string, now: string): Promise<boolean> {
		const result = await this.db
			.prepare(
				`UPDATE work_trade_discounts SET
			status = 'opted_in', member_opted_in_at = ?3, updated_at = ?3
			WHERE member_id = ?1 AND month = ?2 AND status = 'approved'`
			)
			.bind(memberId, month, now)
			.run();
		return result.meta.changes === 1;
	}

	async markShopifyUpdated(memberId: string, month: string, now: string): Promise<boolean> {
		const result = await this.db
			.prepare(
				`UPDATE work_trade_discounts SET
			status = 'shopify_updated', shopify_updated_at = ?3, updated_at = ?3
			WHERE member_id = ?1 AND month = ?2 AND status = 'opted_in'`
			)
			.bind(memberId, month, now)
			.run();
		return result.meta.changes === 1;
	}
}
