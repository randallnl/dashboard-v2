import type { ProjectEventRecord, ProjectEventSource, Shift } from '$lib/types/domain';
import type { ColabShiftRow, ProjectEventRecordRow } from './types';

function parseStringArray(value: string): string[] {
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
	} catch {
		return [];
	}
}

function parseRecord(value: string): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(value);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			return {};
		}

		return Object.fromEntries(Object.entries(parsed));
	} catch {
		return {};
	}
}

export function mapShiftRow(row: ColabShiftRow): Shift {
	return {
		id: row.id,
		boardId: row.board_id,
		parentId: row.parent_id,
		month: row.month,
		title: row.title,
		dateLabel: row.date_label,
		dateValue: row.date_value,
		timeLabel: row.time_label,
		memberId: row.member_id,
		person: row.person,
		coveredBy: row.covered_by,
		coverageStatus: row.coverage_status,
		isCovered: row.is_covered === 1,
		tags: parseStringArray(row.tags_json),
		syncedAt: row.synced_at
	};
}

export function mapProjectEventRow(row: ProjectEventRecordRow): ProjectEventRecord {
	return {
		id: row.id,
		source: row.source as ProjectEventSource,
		title: row.title,
		dateValue: row.date_value,
		endDateValue: row.end_date_value,
		status: row.status,
		location: row.location,
		owner: row.owner,
		adminOnly: row.admin_only === 1,
		record: parseRecord(row.record_json),
		syncedAt: row.synced_at
	};
}
