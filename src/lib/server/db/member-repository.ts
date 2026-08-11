import type { Member } from '$lib/types/domain';
import type { Database } from './types';

type MemberRow = {
	id: string;
	preferred_name: string;
	first_name: string;
	last_name: string;
	membership_type: string;
	email: string;
	other_emails_json: string;
	phone: string;
	business_name: string;
	website: string;
	social_media: string;
	creative_ground_url: string;
	artist_description: string;
	artist_photo_url: string;
	artist_banner_url: string;
	sign_up_date: string;
};

export function memberNames(preferredName: string): { firstName: string; lastName: string } {
	const parts = preferredName.trim().split(/\s+/u).filter(Boolean);
	return {
		firstName: parts[0] ?? '',
		lastName: parts.length > 1 ? (parts.at(-1) ?? '') : ''
	};
}

function mapMember(row: MemberRow): Member {
	return {
		id: row.id,
		preferredName: row.preferred_name,
		membershipType: row.membership_type,
		email: row.email,
		otherEmails: JSON.parse(row.other_emails_json) as string[],
		phone: row.phone,
		businessName: row.business_name,
		website: row.website,
		socialMedia: row.social_media,
		creativeGroundUrl: row.creative_ground_url,
		artistDescription: row.artist_description,
		artistPhotoUrl: row.artist_photo_url,
		artistBannerUrl: row.artist_banner_url,
		signUpDate: row.sign_up_date
	};
}

export class MemberRepository {
	constructor(private readonly db: Database) {}

	async upsert(member: Member, syncedAt: string): Promise<void> {
		const { firstName, lastName } = memberNames(member.preferredName);
		await this.db
			.prepare(
				`INSERT INTO member_directory (
					id, preferred_name, first_name, last_name, membership_type, email,
					other_emails_json, phone, business_name, website, social_media,
					creative_ground_url, artist_description, artist_photo_url,
					artist_banner_url, sign_up_date, synced_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
				ON CONFLICT(id) DO UPDATE SET
					preferred_name = excluded.preferred_name,
					first_name = excluded.first_name,
					last_name = excluded.last_name,
					membership_type = excluded.membership_type,
					email = excluded.email,
					other_emails_json = excluded.other_emails_json,
					phone = excluded.phone,
					business_name = excluded.business_name,
					website = excluded.website,
					social_media = excluded.social_media,
					creative_ground_url = excluded.creative_ground_url,
					artist_description = excluded.artist_description,
					artist_photo_url = excluded.artist_photo_url,
					artist_banner_url = excluded.artist_banner_url,
					sign_up_date = excluded.sign_up_date,
					synced_at = excluded.synced_at`
			)
			.bind(
				member.id,
				member.preferredName,
				firstName,
				lastName,
				member.membershipType,
				member.email,
				JSON.stringify(member.otherEmails),
				member.phone,
				member.businessName,
				member.website,
				member.socialMedia,
				member.creativeGroundUrl,
				member.artistDescription,
				member.artistPhotoUrl,
				member.artistBannerUrl,
				member.signUpDate,
				syncedAt
			)
			.run();
	}

	async findById(id: string): Promise<Member | null> {
		const row = await this.db
			.prepare('SELECT * FROM member_directory WHERE id = ?1 LIMIT 1')
			.bind(id)
			.first<MemberRow>();
		return row ? mapMember(row) : null;
	}

	async findByEmail(email: string): Promise<Member | null> {
		const row = await this.db
			.prepare(
				`SELECT * FROM member_directory
				 WHERE email = ?1 OR EXISTS (
					SELECT 1 FROM json_each(other_emails_json) WHERE lower(value) = ?1
				 )
				 LIMIT 1`
			)
			.bind(email.trim().toLocaleLowerCase('en-US'))
			.first<MemberRow>();
		return row ? mapMember(row) : null;
	}

	async search(query = '', limit = 10): Promise<Member[]> {
		const normalized = query.trim().toLocaleLowerCase('en-US');
		const result = await this.db
			.prepare(
				`SELECT * FROM member_directory
				 WHERE ?1 = ''
				    OR instr(lower(preferred_name), ?1) > 0
				    OR instr(lower(first_name || ' ' || last_name), ?1) > 0
				 ORDER BY first_name ASC, last_name ASC, preferred_name ASC
				 LIMIT ?2`
			)
			.bind(normalized, Math.min(Math.max(limit, 1), 100))
			.all<MemberRow>();
		return result.results.map(mapMember);
	}

	async listIds(): Promise<Set<string>> {
		const result = await this.db.prepare('SELECT id FROM member_directory').all<{ id: string }>();
		return new Set(result.results.map((row) => row.id));
	}

	async removeMissing(activeIds: string[]): Promise<number> {
		if (!activeIds.length) return 0;
		const placeholders = activeIds.map((_, index) => `?${index + 1}`).join(', ');
		const result = await this.db
			.prepare(`DELETE FROM member_directory WHERE id NOT IN (${placeholders})`)
			.bind(...activeIds)
			.run();
		return result.meta.changes;
	}
}
