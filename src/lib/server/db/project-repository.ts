import type { ProjectEventRecord, ProjectEventSource } from '$lib/types/domain';
import { mapProjectEventRow } from './mappers';
import type { Database, ProjectEventRecordRow } from './types';

export type ProjectEventFilters = {
	source?: ProjectEventSource;
	status?: string;
	fromDate?: string;
	throughDate?: string;
	search?: string;
	includeAdminOnly?: boolean;
};

export type ProjectEventPage = {
	records: ProjectEventRecord[];
	total: number;
	page: number;
	pageSize: number;
	statuses: string[];
};

export class ProjectEventRepository {
	constructor(private readonly db: Database) {}

	async upsert(event: ProjectEventRecord): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO project_event_records (
					id, source, title, date_value, end_date_value, status, location,
					owner, admin_only, record_json, synced_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
				ON CONFLICT(source, id) DO UPDATE SET
					title = excluded.title,
					date_value = excluded.date_value,
					end_date_value = excluded.end_date_value,
					status = excluded.status,
					location = excluded.location,
					owner = excluded.owner,
					admin_only = excluded.admin_only,
					record_json = excluded.record_json,
					synced_at = excluded.synced_at`
			)
			.bind(
				event.id,
				event.source,
				event.title,
				event.dateValue,
				event.endDateValue,
				event.status,
				event.location,
				event.owner,
				event.adminOnly ? 1 : 0,
				JSON.stringify(event.record),
				event.syncedAt
			)
			.run();
	}

	async findById(source: ProjectEventSource, id: string): Promise<ProjectEventRecord | null> {
		const row = await this.db
			.prepare(
				`SELECT * FROM project_event_records
				 WHERE source = ?1 AND id = ?2
				 LIMIT 1`
			)
			.bind(source, id)
			.first<ProjectEventRecordRow>();

		return row ? mapProjectEventRow(row) : null;
	}

	async list(filters: ProjectEventFilters = {}): Promise<ProjectEventRecord[]> {
		const source = filters.source ?? '';
		const status = filters.status ?? '';
		const fromDate = filters.fromDate ?? '';
		const includeAdminOnly = filters.includeAdminOnly ? 1 : 0;

		const result = await this.db
			.prepare(
				`SELECT * FROM project_event_records
				 WHERE (?1 = '' OR source = ?1)
				   AND (?2 = '' OR status = ?2)
				   AND (?3 = '' OR date_value >= ?3)
				   AND (?4 = 1 OR admin_only = 0)
				 ORDER BY date_value ASC, title ASC`
			)
			.bind(source, status, fromDate, includeAdminOnly)
			.all<ProjectEventRecordRow>();

		return result.results.map(mapProjectEventRow);
	}

	async listPage(
		filters: ProjectEventFilters = {},
		page = 1,
		pageSize = 24
	): Promise<ProjectEventPage> {
		const source = filters.source ?? '';
		const status = filters.status ?? '';
		const fromDate = filters.fromDate ?? '';
		const throughDate = filters.throughDate ?? '';
		const search = filters.search?.trim().toLocaleLowerCase('en-US') ?? '';
		const safePageSize = Math.min(Math.max(pageSize, 1), 50);
		const safePage = Math.max(page, 1);
		const offset = (safePage - 1) * safePageSize;
		const includeAdminOnly = filters.includeAdminOnly ? 1 : 0;
		const where = `WHERE (?1 = '' OR source = ?1)
				   AND (?2 = '' OR status = ?2)
				   AND (?3 = '' OR date_value >= ?3)
				   AND (?4 = '' OR date_value <= ?4)
				   AND (?5 = '' OR instr(lower(title || ' ' || owner || ' ' || location), ?5) > 0)
				   AND (?6 = 1 OR admin_only = 0)`;
		const bindings = [source, status, fromDate, throughDate, search, includeAdminOnly] as const;

		const [recordsResult, countRow, statusResult] = await Promise.all([
			this.db
				.prepare(
					`SELECT * FROM project_event_records
					 ${where}
					 ORDER BY
					   CASE WHEN date_value >= date('now') THEN 0 ELSE 1 END ASC,
					   CASE WHEN date_value >= date('now') THEN date_value END ASC,
					   CASE WHEN date_value < date('now') THEN date_value END DESC,
					   title ASC
					 LIMIT ?7 OFFSET ?8`
				)
				.bind(...bindings, safePageSize, offset)
				.all<ProjectEventRecordRow>(),
			this.db
				.prepare(`SELECT COUNT(*) AS total FROM project_event_records ${where}`)
				.bind(...bindings)
				.first<{ total: number }>(),
			this.db
				.prepare(
					`SELECT DISTINCT status FROM project_event_records
					 WHERE status <> ''
					 ORDER BY status ASC`
				)
				.all<{ status: string }>()
		]);

		return {
			records: recordsResult.results.map(mapProjectEventRow),
			total: countRow?.total ?? 0,
			page: safePage,
			pageSize: safePageSize,
			statuses: statusResult.results.map((row) => row.status)
		};
	}

	async listForCalendar(
		fromDate: string,
		throughDate: string,
		includeAdminOnly: boolean
	): Promise<ProjectEventRecord[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM project_event_records
				 WHERE date_value <= ?2
				   AND (end_date_value = '' OR end_date_value >= ?1)
				   AND (?3 = 1 OR admin_only = 0)
				 ORDER BY date_value ASC, title ASC`
			)
			.bind(fromDate, throughDate, includeAdminOnly ? 1 : 0)
			.all<ProjectEventRecordRow>();
		return result.results.map(mapProjectEventRow);
	}
}
