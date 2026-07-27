import type { Database } from './types';

export class NotificationRepository {
	constructor(private readonly db: Database) {}

	async listReadKeys(memberId: string): Promise<string[]> {
		const result = await this.db
			.prepare(
				`SELECT notification_key
				 FROM notification_reads
				 WHERE member_id = ?1`
			)
			.bind(memberId)
			.all<{ notification_key: string }>();
		return result.results.map((row) => row.notification_key);
	}

	async markRead(memberId: string, notificationKey: string): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO notification_reads (member_id, notification_key, read_at)
				 VALUES (?1, ?2, CURRENT_TIMESTAMP)
				 ON CONFLICT(member_id, notification_key)
				 DO UPDATE SET read_at = CURRENT_TIMESTAMP`
			)
			.bind(memberId, notificationKey)
			.run();
	}
}
