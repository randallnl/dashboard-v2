import type { CleanupResult, Database, MagicLoginTokenRow, MagicSessionRow } from './types';

export type NewMagicLoginToken = {
	tokenHash: string;
	email: string;
	expiresAt: string;
};

export type NewMagicSession = {
	sessionHash: string;
	email: string;
	memberId: string;
	expiresAt: string;
};

export class AuthRepository {
	constructor(private readonly db: Database) {}

	async createLoginToken(input: NewMagicLoginToken): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO magic_login_tokens (token_hash, email, expires_at)
				 VALUES (?1, ?2, ?3)`
			)
			.bind(input.tokenHash, input.email, input.expiresAt)
			.run();
	}

	async findValidLoginToken(tokenHash: string, now: string): Promise<MagicLoginTokenRow | null> {
		return this.db
			.prepare(
				`SELECT token_hash, email, expires_at, used_at, created_at
				 FROM magic_login_tokens
				 WHERE token_hash = ?1 AND used_at = '' AND expires_at > ?2
				 LIMIT 1`
			)
			.bind(tokenHash, now)
			.first<MagicLoginTokenRow>();
	}

	async consumeLoginToken(tokenHash: string, usedAt: string): Promise<boolean> {
		const result = await this.db
			.prepare(
				`UPDATE magic_login_tokens
				 SET used_at = ?2
				 WHERE token_hash = ?1 AND used_at = '' AND expires_at > ?2`
			)
			.bind(tokenHash, usedAt)
			.run();

		return result.meta.changes === 1;
	}

	async createSession(input: NewMagicSession): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO magic_sessions (session_hash, email, member_id, expires_at)
				 VALUES (?1, ?2, ?3, ?4)`
			)
			.bind(input.sessionHash, input.email, input.memberId, input.expiresAt)
			.run();
	}

	async findValidSession(sessionHash: string, now: string): Promise<MagicSessionRow | null> {
		return this.db
			.prepare(
				`SELECT session_hash, email, member_id, expires_at, created_at, last_seen_at
				 FROM magic_sessions
				 WHERE session_hash = ?1 AND expires_at > ?2
				 LIMIT 1`
			)
			.bind(sessionHash, now)
			.first<MagicSessionRow>();
	}

	async touchSession(sessionHash: string, seenAt: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE magic_sessions
				 SET last_seen_at = ?2
				 WHERE session_hash = ?1 AND expires_at > ?2`
			)
			.bind(sessionHash, seenAt)
			.run();
	}

	async deleteSession(sessionHash: string): Promise<void> {
		await this.db
			.prepare('DELETE FROM magic_sessions WHERE session_hash = ?1')
			.bind(sessionHash)
			.run();
	}

	async cleanupExpired(now: string): Promise<CleanupResult> {
		const [tokens, sessions] = await this.db.batch([
			this.db
				.prepare(`DELETE FROM magic_login_tokens WHERE expires_at <= ?1 OR used_at <> ''`)
				.bind(now),
			this.db.prepare('DELETE FROM magic_sessions WHERE expires_at <= ?1').bind(now)
		]);

		return {
			tokensDeleted: tokens.meta.changes,
			sessionsDeleted: sessions.meta.changes
		};
	}
}
