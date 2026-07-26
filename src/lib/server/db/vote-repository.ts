import type { Database } from './types';

export class VoteRepository {
	constructor(private readonly db: Database) {}

	async reserve(memberId: string, voteKey: string): Promise<boolean> {
		const result = await this.db
			.prepare(
				`INSERT OR IGNORE INTO vote_submissions (member_id, vote_key)
				 VALUES (?1, ?2)`
			)
			.bind(memberId, voteKey)
			.run();
		return result.meta.changes === 1;
	}

	async complete(
		memberId: string,
		voteKey: string,
		response: string,
		mondayItemId: string
	): Promise<void> {
		await this.db
			.prepare(
				`UPDATE vote_submissions
				 SET response = ?3, monday_item_id = ?4
				 WHERE member_id = ?1 AND vote_key = ?2`
			)
			.bind(memberId, voteKey, response, mondayItemId)
			.run();
	}

	async release(memberId: string, voteKey: string): Promise<void> {
		await this.db
			.prepare(
				`DELETE FROM vote_submissions
				 WHERE member_id = ?1 AND vote_key = ?2 AND monday_item_id = ''`
			)
			.bind(memberId, voteKey)
			.run();
	}
}
