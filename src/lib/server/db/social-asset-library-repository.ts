import type { SocialLibraryAsset } from '$lib/types/domain';
import type { Database } from './types';

type SocialLibraryAssetRow = {
	id: string;
	object_key: string;
	filename: string;
	content_type: string;
	byte_size: number;
	alt_text: string;
	tags_json: string;
	credit: string;
	created_by_member_id: string;
	created_at: string;
};

export type NewSocialLibraryAsset = Omit<SocialLibraryAsset, 'createdAt'>;

function tags(value: string): string[] {
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((tag): tag is string => typeof tag === 'string').slice(0, 20)
			: [];
	} catch {
		return [];
	}
}

function mapAsset(row: SocialLibraryAssetRow): SocialLibraryAsset {
	return {
		id: row.id,
		objectKey: row.object_key,
		filename: row.filename,
		contentType: row.content_type,
		byteSize: row.byte_size,
		altText: row.alt_text,
		tags: tags(row.tags_json),
		credit: row.credit,
		createdByMemberId: row.created_by_member_id,
		createdAt: row.created_at
	};
}

export class SocialAssetLibraryRepository {
	constructor(private readonly db: Database) {}

	async list(limit = 120): Promise<SocialLibraryAsset[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM social_library_assets
				 ORDER BY created_at DESC
				 LIMIT ?1`
			)
			.bind(Math.min(Math.max(limit, 1), 250))
			.all<SocialLibraryAssetRow>();
		return result.results.map(mapAsset);
	}

	async find(id: string): Promise<SocialLibraryAsset | null> {
		const row = await this.db
			.prepare('SELECT * FROM social_library_assets WHERE id = ?1 LIMIT 1')
			.bind(id)
			.first<SocialLibraryAssetRow>();
		return row ? mapAsset(row) : null;
	}

	async findMany(ids: string[]): Promise<SocialLibraryAsset[]> {
		const uniqueIds = [...new Set(ids)].slice(0, 30);
		if (!uniqueIds.length) return [];
		const placeholders = uniqueIds.map((_, index) => `?${index + 1}`).join(', ');
		const result = await this.db
			.prepare(`SELECT * FROM social_library_assets WHERE id IN (${placeholders})`)
			.bind(...uniqueIds)
			.all<SocialLibraryAssetRow>();
		return result.results.map(mapAsset);
	}

	async create(asset: NewSocialLibraryAsset, now: string): Promise<SocialLibraryAsset> {
		await this.db
			.prepare(
				`INSERT INTO social_library_assets (
					id, object_key, filename, content_type, byte_size, alt_text, tags_json, credit,
					created_by_member_id, created_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
			)
			.bind(
				asset.id,
				asset.objectKey,
				asset.filename,
				asset.contentType,
				asset.byteSize,
				asset.altText,
				JSON.stringify(asset.tags),
				asset.credit,
				asset.createdByMemberId,
				now
			)
			.run();
		return (await this.find(asset.id))!;
	}
}
