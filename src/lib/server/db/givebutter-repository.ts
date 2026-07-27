import type { GivebutterSignup } from '$lib/types/domain';
import type { Database } from './types';

type SignupRow = {
	id: string;
	donor_name: string;
	donor_email: string;
	campaign_id: string;
	event_title: string;
	ticket_type: string;
	transaction_date: string;
	synced_at: string;
};

function mapSignup(row: SignupRow): GivebutterSignup {
	return {
		id: row.id,
		donorName: row.donor_name,
		donorEmail: row.donor_email,
		campaignId: row.campaign_id,
		eventTitle: row.event_title,
		ticketType: row.ticket_type,
		transactionDate: row.transaction_date,
		syncedAt: row.synced_at
	};
}

export class GivebutterRepository {
	constructor(private readonly db: Database) {}

	async upsert(signup: GivebutterSignup): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO givebutter_signups (
					id, donor_name, donor_email, campaign_id, event_title, ticket_type, transaction_date, synced_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
				ON CONFLICT(id) DO UPDATE SET
					donor_name = excluded.donor_name,
					donor_email = excluded.donor_email,
					campaign_id = excluded.campaign_id,
					event_title = excluded.event_title,
					ticket_type = excluded.ticket_type,
					transaction_date = excluded.transaction_date,
					synced_at = excluded.synced_at`
			)
			.bind(
				signup.id,
				signup.donorName,
				signup.donorEmail,
				signup.campaignId,
				signup.eventTitle,
				signup.ticketType,
				signup.transactionDate,
				signup.syncedAt
			)
			.run();
	}

	async listByCampaign(campaignId: string): Promise<GivebutterSignup[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM givebutter_signups
				 WHERE lower(campaign_id) = lower(?1)
				 ORDER BY transaction_date DESC, donor_name ASC`
			)
			.bind(campaignId.trim())
			.all<SignupRow>();
		return result.results.map(mapSignup);
	}

	async removeMissing(activeIds: string[]): Promise<number> {
		if (!activeIds.length) return 0;
		const placeholders = activeIds.map((_, index) => `?${index + 1}`).join(', ');
		const result = await this.db
			.prepare(`DELETE FROM givebutter_signups WHERE id NOT IN (${placeholders})`)
			.bind(...activeIds)
			.run();
		return result.meta.changes;
	}
}
