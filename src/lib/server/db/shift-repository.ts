import type { Shift } from '$lib/types/domain';
import { mapShiftRow } from './mappers';
import type { ColabShiftRow, Database } from './types';

export class ShiftRepository {
	constructor(private readonly db: Database) {}

	async upsert(shift: Shift): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO colab_shifts (
					id, board_id, parent_id, month, title, date_label, date_value, time_label,
					member_id, person, covered_by, coverage_status, is_covered, tags_json, synced_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
				ON CONFLICT(id) DO UPDATE SET
					board_id = excluded.board_id,
					parent_id = excluded.parent_id,
					month = excluded.month,
					title = excluded.title,
					date_label = excluded.date_label,
					date_value = excluded.date_value,
					time_label = excluded.time_label,
					member_id = excluded.member_id,
					person = excluded.person,
					covered_by = excluded.covered_by,
					coverage_status = excluded.coverage_status,
					is_covered = excluded.is_covered,
					tags_json = excluded.tags_json,
					synced_at = excluded.synced_at`
			)
			.bind(
				shift.id,
				shift.boardId,
				shift.parentId,
				shift.month,
				shift.title,
				shift.dateLabel,
				shift.dateValue,
				shift.timeLabel,
				shift.memberId,
				shift.person,
				shift.coveredBy,
				shift.coverageStatus,
				shift.isCovered ? 1 : 0,
				JSON.stringify(shift.tags),
				shift.syncedAt
			)
			.run();
	}

	async findById(id: string): Promise<Shift | null> {
		const row = await this.db
			.prepare('SELECT * FROM colab_shifts WHERE id = ?1 LIMIT 1')
			.bind(id)
			.first<ColabShiftRow>();

		return row ? mapShiftRow(row) : null;
	}

	async listFromDate(date: string): Promise<Shift[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM colab_shifts
				 WHERE date_value >= ?1
				 ORDER BY date_value ASC, title ASC`
			)
			.bind(date)
			.all<ColabShiftRow>();

		return result.results.map(mapShiftRow);
	}

	async listBetween(fromDate: string, throughDate: string): Promise<Shift[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM colab_shifts
				 WHERE date_value >= ?1 AND date_value <= ?2
				 ORDER BY date_value ASC, title ASC`
			)
			.bind(fromDate, throughDate)
			.all<ColabShiftRow>();
		return result.results.map(mapShiftRow);
	}

	async claimIfOpen(
		id: string,
		memberId: string,
		person: string,
		syncedAt: string
	): Promise<boolean> {
		const result = await this.db
			.prepare(
				`UPDATE colab_shifts
				 SET member_id = ?2, person = ?3, covered_by = ?3,
				     coverage_status = 'Covered', is_covered = 1, synced_at = ?4
				 WHERE id = ?1 AND is_covered = 0`
			)
			.bind(id, memberId, person, syncedAt)
			.run();
		return result.meta.changes === 1;
	}

	async releaseClaim(id: string, memberId: string, syncedAt: string): Promise<void> {
		await this.db
			.prepare(
				`UPDATE colab_shifts
				 SET member_id = '', person = '', covered_by = '',
				     coverage_status = 'Open', is_covered = 0, synced_at = ?3
				 WHERE id = ?1 AND member_id = ?2`
			)
			.bind(id, memberId, syncedAt)
			.run();
	}
}
