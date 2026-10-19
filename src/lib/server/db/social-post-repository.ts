import type {
	SocialPlatform,
	SocialPost,
	SocialPostAsset,
	SocialPostChannel,
	SocialPostReview,
	SocialPostReviewAction,
	SocialPostStatus
} from '$lib/types/domain';
import type { Database } from './types';

type SocialPostRow = {
	id: string;
	title: string;
	body: string;
	status: SocialPostStatus;
	scheduled_at: string;
	published_at: string;
	published_url: string;
	project_source: '' | 'project' | 'community';
	project_id: string;
	created_by_member_id: string;
	created_at: string;
	updated_at: string;
};

type SocialPostChannelRow = {
	post_id: string;
	platform: SocialPlatform;
	body: string;
	status: SocialPostStatus;
	scheduled_at: string;
	published_at: string;
	published_url: string;
};

type SocialPostAssetRow = {
	id: string;
	post_id: string;
	storage: 'r2' | 'source';
	object_key: string;
	source_url: string;
	filename: string;
	content_type: string;
	byte_size: number;
	created_at: string;
};

type SocialPostReviewRow = {
	id: string;
	post_id: string;
	action: SocialPostReviewAction;
	note: string;
	member_id: string;
	member_name: string;
	created_at: string;
};

export type NewSocialPost = Omit<
	SocialPost,
	'createdAt' | 'updatedAt' | 'publishedAt' | 'publishedUrl' | 'assets' | 'reviews'
> & {
	assets: Array<Omit<SocialPostAsset, 'id' | 'postId' | 'createdAt'>>;
};

export type SocialPostUpdate = Pick<
	SocialPost,
	'title' | 'copy' | 'status' | 'scheduledAt' | 'publishedAt' | 'publishedUrl' | 'channels'
>;

export type NewSocialPostReview = Pick<SocialPostReview, 'action' | 'note' | 'memberId'>;

function mapPost(row: SocialPostRow): SocialPost {
	return {
		id: row.id,
		title: row.title,
		copy: row.body,
		status: row.status,
		scheduledAt: row.scheduled_at,
		publishedAt: row.published_at,
		publishedUrl: row.published_url,
		projectSource: row.project_source,
		projectId: row.project_id,
		createdByMemberId: row.created_by_member_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		channels: [],
		assets: [],
		reviews: []
	};
}

function mapChannel(row: SocialPostChannelRow): SocialPostChannel {
	return {
		platform: row.platform,
		copy: row.body,
		status: row.status,
		scheduledAt: row.scheduled_at,
		publishedAt: row.published_at,
		publishedUrl: row.published_url
	};
}

function mapAsset(row: SocialPostAssetRow): SocialPostAsset {
	return {
		id: row.id,
		postId: row.post_id,
		storage: row.storage,
		objectKey: row.object_key,
		sourceUrl: row.source_url,
		filename: row.filename,
		contentType: row.content_type,
		byteSize: row.byte_size,
		createdAt: row.created_at
	};
}

function mapReview(row: SocialPostReviewRow): SocialPostReview {
	return {
		id: row.id,
		postId: row.post_id,
		action: row.action,
		note: row.note,
		memberId: row.member_id,
		memberName: row.member_name || 'Team member',
		createdAt: row.created_at
	};
}

export class SocialPostRepository {
	constructor(private readonly db: Database) {}

	async list(limit = 100): Promise<SocialPost[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM social_posts
				 ORDER BY CASE status WHEN 'scheduled' THEN 0 WHEN 'review' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
				 CASE WHEN scheduled_at = '' THEN 1 ELSE 0 END, scheduled_at ASC, updated_at DESC
				 LIMIT ?1`
			)
			.bind(Math.min(Math.max(limit, 1), 200))
			.all<SocialPostRow>();
		return Promise.all(result.results.map((row) => this.hydrate(mapPost(row))));
	}

	async find(id: string): Promise<SocialPost | null> {
		const row = await this.db
			.prepare('SELECT * FROM social_posts WHERE id = ?1 LIMIT 1')
			.bind(id)
			.first<SocialPostRow>();
		return row ? this.hydrate(mapPost(row)) : null;
	}

	async create(input: NewSocialPost, now: string): Promise<SocialPost> {
		await this.db
			.prepare(
				`INSERT INTO social_posts (
					id, title, body, status, scheduled_at, project_source, project_id,
					created_by_member_id, created_at, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`
			)
			.bind(
				input.id,
				input.title,
				input.copy,
				input.status,
				input.scheduledAt,
				input.projectSource,
				input.projectId,
				input.createdByMemberId,
				now
			)
			.run();
		await this.replaceChannels(input.id, input.channels);
		await this.addAssets(input.id, input.assets, now);
		return (await this.find(input.id))!;
	}

	async update(id: string, input: SocialPostUpdate, now: string): Promise<SocialPost | null> {
		const result = await this.db
			.prepare(
				`UPDATE social_posts
				 SET title = ?2, body = ?3, status = ?4, scheduled_at = ?5,
					 published_at = ?6, published_url = ?7, updated_at = ?8
				 WHERE id = ?1`
			)
			.bind(
				id,
				input.title,
				input.copy,
				input.status,
				input.scheduledAt,
				input.publishedAt,
				input.publishedUrl,
				now
			)
			.run();
		if (!result.meta.changes) return null;
		await this.replaceChannels(id, input.channels);
		return this.find(id);
	}

	async addAssets(
		postId: string,
		assets: Array<Omit<SocialPostAsset, 'id' | 'postId' | 'createdAt'>>,
		now: string
	): Promise<void> {
		if (!assets.length) return;
		await this.db.batch(
			assets.map((asset) =>
				this.db
					.prepare(
						`INSERT INTO social_post_assets (
							id, post_id, storage, object_key, source_url, filename, content_type, byte_size, created_at
						) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
					)
					.bind(
						crypto.randomUUID(),
						postId,
						asset.storage,
						asset.objectKey,
						asset.sourceUrl,
						asset.filename,
						asset.contentType,
						asset.byteSize,
						now
					)
			)
		);
	}

	async findAsset(assetId: string): Promise<SocialPostAsset | null> {
		const row = await this.db
			.prepare('SELECT * FROM social_post_assets WHERE id = ?1 LIMIT 1')
			.bind(assetId)
			.first<SocialPostAssetRow>();
		return row ? mapAsset(row) : null;
	}

	async addReview(
		postId: string,
		review: NewSocialPostReview,
		now: string
	): Promise<SocialPost | null> {
		const exists = await this.db
			.prepare('SELECT id FROM social_posts WHERE id = ?1 LIMIT 1')
			.bind(postId)
			.first<{ id: string }>();
		if (!exists) return null;
		await this.db
			.prepare(
				`INSERT INTO social_post_reviews (id, post_id, action, note, member_id, created_at)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
			)
			.bind(crypto.randomUUID(), postId, review.action, review.note, review.memberId, now)
			.run();
		return this.find(postId);
	}

	async setWorkflowStatus(
		postId: string,
		status: Extract<SocialPostStatus, 'draft' | 'review'>,
		now: string
	): Promise<SocialPost | null> {
		const [postResult] = await this.db.batch([
			this.db
				.prepare('UPDATE social_posts SET status = ?2, updated_at = ?3 WHERE id = ?1')
				.bind(postId, status, now),
			this.db
				.prepare('UPDATE social_post_channels SET status = ?2 WHERE post_id = ?1')
				.bind(postId, status)
		]);
		if (!postResult.meta.changes) return null;
		return this.find(postId);
	}

	private async hydrate(post: SocialPost): Promise<SocialPost> {
		const [channels, assets, reviews] = await Promise.all([
			this.db
				.prepare('SELECT * FROM social_post_channels WHERE post_id = ?1 ORDER BY platform ASC')
				.bind(post.id)
				.all<SocialPostChannelRow>(),
			this.db
				.prepare('SELECT * FROM social_post_assets WHERE post_id = ?1 ORDER BY created_at ASC')
				.bind(post.id)
				.all<SocialPostAssetRow>(),
			this.db
				.prepare(
					`SELECT r.id, r.post_id, r.action, r.note, r.member_id, r.created_at,
						COALESCE(NULLIF(m.preferred_name, ''), 'Team member') AS member_name
					 FROM social_post_reviews r
					 LEFT JOIN member_directory m ON m.id = r.member_id
					 WHERE r.post_id = ?1
					 ORDER BY r.created_at DESC`
				)
				.bind(post.id)
				.all<SocialPostReviewRow>()
		]);
		return {
			...post,
			channels: channels.results.map(mapChannel),
			assets: assets.results.map(mapAsset),
			reviews: reviews.results.map(mapReview)
		};
	}

	private async replaceChannels(postId: string, channels: SocialPostChannel[]): Promise<void> {
		const statements = [
			this.db.prepare('DELETE FROM social_post_channels WHERE post_id = ?1').bind(postId),
			...channels.map((channel) =>
				this.db
					.prepare(
						`INSERT INTO social_post_channels (
							post_id, platform, body, status, scheduled_at, published_at, published_url
						) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
					)
					.bind(
						postId,
						channel.platform,
						channel.copy,
						channel.status,
						channel.scheduledAt,
						channel.publishedAt,
						channel.publishedUrl
					)
			)
		];
		await this.db.batch(statements);
	}
}
