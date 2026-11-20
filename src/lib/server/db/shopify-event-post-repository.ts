import type { Database } from './types';

export type ShopifyEventPost = {
	projectId: string;
	articleId: string;
	articleHandle: string;
	blogHandle: string;
	publicUrl: string;
	createdByMemberId: string;
	createdAt: string;
	updatedAt: string;
};

type ShopifyEventPostRow = {
	project_id: string;
	article_id: string;
	article_handle: string;
	blog_handle: string;
	public_url: string;
	created_by_member_id: string;
	created_at: string;
	updated_at: string;
};

function mapPost(row: ShopifyEventPostRow): ShopifyEventPost {
	return {
		projectId: row.project_id,
		articleId: row.article_id,
		articleHandle: row.article_handle,
		blogHandle: row.blog_handle,
		publicUrl: row.public_url,
		createdByMemberId: row.created_by_member_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export class ShopifyEventPostRepository {
	constructor(private readonly db: Database) {}

	async findByProjectId(projectId: string): Promise<ShopifyEventPost | null> {
		const row = await this.db
			.prepare(
				`SELECT project_id, article_id, article_handle, blog_handle, public_url,
					created_by_member_id, created_at, updated_at
				 FROM project_shopify_event_posts
				 WHERE project_id = ?1
				 LIMIT 1`
			)
			.bind(projectId)
			.first<ShopifyEventPostRow>();
		return row ? mapPost(row) : null;
	}

	async save(input: ShopifyEventPost): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO project_shopify_event_posts (
					project_id, article_id, article_handle, blog_handle, public_url,
					created_by_member_id, created_at, updated_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
				ON CONFLICT(project_id) DO UPDATE SET
					article_id = excluded.article_id,
					article_handle = excluded.article_handle,
					blog_handle = excluded.blog_handle,
					public_url = excluded.public_url,
					updated_at = excluded.updated_at`
			)
			.bind(
				input.projectId,
				input.articleId,
				input.articleHandle,
				input.blogHandle,
				input.publicUrl,
				input.createdByMemberId,
				input.createdAt,
				input.updatedAt
			)
			.run();
	}
}
