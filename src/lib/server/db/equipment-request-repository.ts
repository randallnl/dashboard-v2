import type { EquipmentRequest } from '$lib/types/domain';
import type { Database } from './types';

type EquipmentRequestRow = {
	id: string;
	title: string;
	requestor: string;
	estimated_cost: string;
	product_url: string;
	explanation: string;
	additional_info: string;
	submitted_at: string;
	synced_at: string;
};

function mapRequest(row: EquipmentRequestRow): EquipmentRequest {
	return {
		id: row.id,
		title: row.title,
		requestor: row.requestor,
		estimatedCost: row.estimated_cost,
		productUrl: row.product_url,
		explanation: row.explanation,
		additionalInfo: row.additional_info,
		submittedAt: row.submitted_at,
		syncedAt: row.synced_at
	};
}

export class EquipmentRequestRepository {
	constructor(private readonly db: Database) {}

	async upsert(request: EquipmentRequest): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO equipment_requests (
					id, title, requestor, estimated_cost, product_url, explanation,
					additional_info, submitted_at, synced_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
				ON CONFLICT(id) DO UPDATE SET
					title = excluded.title,
					requestor = excluded.requestor,
					estimated_cost = excluded.estimated_cost,
					product_url = excluded.product_url,
					explanation = excluded.explanation,
					additional_info = excluded.additional_info,
					submitted_at = excluded.submitted_at,
					synced_at = excluded.synced_at`
			)
			.bind(
				request.id,
				request.title,
				request.requestor,
				request.estimatedCost,
				request.productUrl,
				request.explanation,
				request.additionalInfo,
				request.submittedAt,
				request.syncedAt
			)
			.run();
	}

	async list(): Promise<EquipmentRequest[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM equipment_requests
				 ORDER BY submitted_at DESC, title ASC`
			)
			.all<EquipmentRequestRow>();
		return result.results.map(mapRequest);
	}

	async removeMissing(activeIds: string[]): Promise<number> {
		if (!activeIds.length) return 0;
		const placeholders = activeIds.map((_, index) => `?${index + 1}`).join(', ');
		const result = await this.db
			.prepare(`DELETE FROM equipment_requests WHERE id NOT IN (${placeholders})`)
			.bind(...activeIds)
			.run();
		return result.meta.changes;
	}
}
