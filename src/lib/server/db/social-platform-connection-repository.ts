import type { Database } from './types';

export type InstagramConnection = {
	instagramAccountId: string;
	instagramUsername: string;
	facebookPageId: string;
	facebookPageName: string;
	encryptedPageAccessToken: string;
	connectedByMemberId: string;
	connectedAt: string;
	updatedAt: string;
	lastVerifiedAt: string;
	lastError: string;
};

export type InstagramConnectionCandidate = {
	selectionId: string;
	facebookPageId: string;
	facebookPageName: string;
	instagramAccountId: string;
	instagramUsername: string;
	encryptedPageAccessToken: string;
	createdByMemberId: string;
	expiresAt: string;
	createdAt: string;
};

type InstagramConnectionRow = {
	instagram_account_id: string;
	instagram_username: string;
	facebook_page_id: string;
	facebook_page_name: string;
	encrypted_page_access_token: string;
	connected_by_member_id: string;
	connected_at: string;
	updated_at: string;
	last_verified_at: string;
	last_error: string;
};

type InstagramConnectionCandidateRow = {
	selection_id: string;
	facebook_page_id: string;
	facebook_page_name: string;
	instagram_account_id: string;
	instagram_username: string;
	encrypted_page_access_token: string;
	created_by_member_id: string;
	expires_at: string;
	created_at: string;
};

function mapConnection(row: InstagramConnectionRow): InstagramConnection {
	return {
		instagramAccountId: row.instagram_account_id,
		instagramUsername: row.instagram_username,
		facebookPageId: row.facebook_page_id,
		facebookPageName: row.facebook_page_name,
		encryptedPageAccessToken: row.encrypted_page_access_token,
		connectedByMemberId: row.connected_by_member_id,
		connectedAt: row.connected_at,
		updatedAt: row.updated_at,
		lastVerifiedAt: row.last_verified_at,
		lastError: row.last_error
	};
}

function mapCandidate(row: InstagramConnectionCandidateRow): InstagramConnectionCandidate {
	return {
		selectionId: row.selection_id,
		facebookPageId: row.facebook_page_id,
		facebookPageName: row.facebook_page_name,
		instagramAccountId: row.instagram_account_id,
		instagramUsername: row.instagram_username,
		encryptedPageAccessToken: row.encrypted_page_access_token,
		createdByMemberId: row.created_by_member_id,
		expiresAt: row.expires_at,
		createdAt: row.created_at
	};
}

export class SocialPlatformConnectionRepository {
	constructor(private readonly db: Database) {}

	async createInstagramOAuthState(input: {
		stateHash: string;
		createdByMemberId: string;
		expiresAt: string;
		createdAt: string;
	}): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO social_instagram_oauth_state (
					state_hash, created_by_member_id, expires_at, created_at
				) VALUES (?1, ?2, ?3, ?4)`
			)
			.bind(input.stateHash, input.createdByMemberId, input.expiresAt, input.createdAt)
			.run();
	}

	async consumeInstagramOAuthState(stateHash: string, now: string): Promise<string | null> {
		const state = await this.db
			.prepare(
				`SELECT created_by_member_id, expires_at FROM social_instagram_oauth_state
				 WHERE state_hash = ?1 LIMIT 1`
			)
			.bind(stateHash)
			.first<{ created_by_member_id: string; expires_at: string }>();
		await this.db
			.prepare('DELETE FROM social_instagram_oauth_state WHERE state_hash = ?1')
			.bind(stateHash)
			.run();
		if (!state || state.expires_at < now) return null;
		return state.created_by_member_id;
	}

	async connection(): Promise<InstagramConnection | null> {
		const row = await this.db
			.prepare(
				`SELECT instagram_account_id, instagram_username, facebook_page_id, facebook_page_name,
					encrypted_page_access_token, connected_by_member_id, connected_at, updated_at,
					last_verified_at, last_error
				 FROM social_platform_connections WHERE platform = 'instagram' LIMIT 1`
			)
			.first<InstagramConnectionRow>();
		return row ? mapConnection(row) : null;
	}

	async saveInstagramConnection(input: {
		instagramAccountId: string;
		instagramUsername: string;
		facebookPageId: string;
		facebookPageName: string;
		encryptedPageAccessToken: string;
		connectedByMemberId: string;
		now: string;
	}): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO social_platform_connections (
					platform, instagram_account_id, instagram_username, facebook_page_id,
					facebook_page_name, encrypted_page_access_token, connected_by_member_id,
					connected_at, updated_at
				) VALUES ('instagram', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
				ON CONFLICT(platform) DO UPDATE SET
					instagram_account_id = excluded.instagram_account_id,
					instagram_username = excluded.instagram_username,
					facebook_page_id = excluded.facebook_page_id,
					facebook_page_name = excluded.facebook_page_name,
					encrypted_page_access_token = excluded.encrypted_page_access_token,
					connected_by_member_id = excluded.connected_by_member_id,
					connected_at = excluded.connected_at,
					updated_at = excluded.updated_at,
					last_verified_at = '', last_error = ''`
			)
			.bind(
				input.instagramAccountId,
				input.instagramUsername,
				input.facebookPageId,
				input.facebookPageName,
				input.encryptedPageAccessToken,
				input.connectedByMemberId,
				input.now
			)
			.run();
	}

	async saveInstagramCandidates(input: {
		selectionId: string;
		candidates: Array<
			Omit<
				InstagramConnectionCandidate,
				'selectionId' | 'createdByMemberId' | 'expiresAt' | 'createdAt'
			>
		>;
		createdByMemberId: string;
		expiresAt: string;
		createdAt: string;
	}): Promise<void> {
		await this.db
			.prepare('DELETE FROM social_instagram_connection_candidates WHERE created_by_member_id = ?1')
			.bind(input.createdByMemberId)
			.run();
		if (!input.candidates.length) return;
		await this.db.batch(
			input.candidates.map((candidate) =>
				this.db
					.prepare(
						`INSERT INTO social_instagram_connection_candidates (
							selection_id, facebook_page_id, facebook_page_name, instagram_account_id,
							instagram_username, encrypted_page_access_token, created_by_member_id,
							expires_at, created_at
						) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
					)
					.bind(
						input.selectionId,
						candidate.facebookPageId,
						candidate.facebookPageName,
						candidate.instagramAccountId,
						candidate.instagramUsername,
						candidate.encryptedPageAccessToken,
						input.createdByMemberId,
						input.expiresAt,
						input.createdAt
					)
			)
		);
	}

	async listInstagramCandidates(
		memberId: string,
		now: string
	): Promise<InstagramConnectionCandidate[]> {
		await this.db
			.prepare('DELETE FROM social_instagram_connection_candidates WHERE expires_at < ?1')
			.bind(now)
			.run();
		const result = await this.db
			.prepare(
				`SELECT selection_id, facebook_page_id, facebook_page_name, instagram_account_id,
					instagram_username, encrypted_page_access_token, created_by_member_id, expires_at, created_at
				 FROM social_instagram_connection_candidates
				 WHERE created_by_member_id = ?1 AND expires_at >= ?2
				 ORDER BY facebook_page_name COLLATE NOCASE, instagram_username COLLATE NOCASE`
			)
			.bind(memberId, now)
			.all<InstagramConnectionCandidateRow>();
		return result.results.map(mapCandidate);
	}

	async consumeInstagramCandidate(input: {
		selectionId: string;
		facebookPageId: string;
		createdByMemberId: string;
		now: string;
	}): Promise<InstagramConnectionCandidate | null> {
		const row = await this.db
			.prepare(
				`SELECT selection_id, facebook_page_id, facebook_page_name, instagram_account_id,
					instagram_username, encrypted_page_access_token, created_by_member_id, expires_at, created_at
				 FROM social_instagram_connection_candidates
				 WHERE selection_id = ?1 AND facebook_page_id = ?2 AND created_by_member_id = ?3
				 LIMIT 1`
			)
			.bind(input.selectionId, input.facebookPageId, input.createdByMemberId)
			.first<InstagramConnectionCandidateRow>();
		await this.db
			.prepare('DELETE FROM social_instagram_connection_candidates WHERE selection_id = ?1')
			.bind(input.selectionId)
			.run();
		if (!row || row.expires_at < input.now) return null;
		return mapCandidate(row);
	}
}
