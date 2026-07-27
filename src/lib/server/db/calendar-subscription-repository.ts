import type { Database } from './types';

export class CalendarSubscriptionRepository {
	constructor(private readonly db: Database) {}

	async findToken(memberId: string): Promise<string | null> {
		const row = await this.db
			.prepare('SELECT token FROM calendar_subscription_tokens WHERE member_id = ?1')
			.bind(memberId)
			.first<{ token: string }>();
		return row?.token ?? null;
	}

	async save(memberId: string, token: string): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO calendar_subscription_tokens (member_id, token)
				 VALUES (?1, ?2)
				 ON CONFLICT(member_id) DO UPDATE SET token = excluded.token`
			)
			.bind(memberId, token)
			.run();
	}

	async findMemberId(token: string): Promise<string | null> {
		const row = await this.db
			.prepare('SELECT member_id FROM calendar_subscription_tokens WHERE token = ?1 LIMIT 1')
			.bind(token)
			.first<{ member_id: string }>();
		return row?.member_id ?? null;
	}
}
