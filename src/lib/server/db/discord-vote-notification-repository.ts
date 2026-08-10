import type { Database } from './types';

export class DiscordVoteNotificationRepository {
	constructor(private readonly db: Database) {}

	async reserve(voteKey: string, now: string, staleBefore: string): Promise<boolean> {
		const inserted = await this.db
			.prepare(
				`INSERT OR IGNORE INTO discord_vote_notifications (
					vote_key, status, reserved_at, attempts
				) VALUES (?1, 'pending', ?2, 1)`
			)
			.bind(voteKey, now)
			.run();
		if (inserted.meta.changes === 1) return true;

		const reclaimed = await this.db
			.prepare(
				`UPDATE discord_vote_notifications
				 SET reserved_at = ?2, attempts = attempts + 1, last_error = ''
				 WHERE vote_key = ?1
				   AND status = 'pending'
				   AND (reserved_at = '' OR reserved_at <= ?3)`
			)
			.bind(voteKey, now, staleBefore)
			.run();
		return reclaimed.meta.changes === 1;
	}

	async markSent(voteKey: string, postedAt: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE discord_vote_notifications
				 SET status = 'sent', posted_at = ?2, reserved_at = '', last_error = ''
				 WHERE vote_key = ?1`
			)
			.bind(voteKey, postedAt)
			.run();
	}

	async release(voteKey: string, message: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE discord_vote_notifications
				 SET reserved_at = '', last_error = ?2
				 WHERE vote_key = ?1 AND status = 'pending'`
			)
			.bind(voteKey, message.slice(0, 500))
			.run();
	}
}
