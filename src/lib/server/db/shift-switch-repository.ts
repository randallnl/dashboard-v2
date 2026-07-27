import type { ShiftSwitchRequest } from '$lib/types/domain';
import type { Database } from './types';

type Row = {
	id: string;
	shift_id: string;
	requester_member_id: string;
	replacement_member_id: string;
	request_type: ShiftSwitchRequest['requestType'];
	status: ShiftSwitchRequest['status'];
	shift_title: string;
	shift_date: string;
	shift_time: string;
	requester_label: string;
	replacement_label: string;
	created_at: string;
	responded_at: string;
	last_reminded_at: string;
};

function map(row: Row): ShiftSwitchRequest {
	return {
		id: row.id,
		shiftId: row.shift_id,
		requesterMemberId: row.requester_member_id,
		replacementMemberId: row.replacement_member_id,
		requestType: row.request_type,
		status: row.status,
		shiftTitle: row.shift_title,
		shiftDate: row.shift_date,
		shiftTime: row.shift_time,
		requesterLabel: row.requester_label,
		replacementLabel: row.replacement_label,
		createdAt: row.created_at,
		respondedAt: row.responded_at,
		lastRemindedAt: row.last_reminded_at
	};
}

export class ShiftSwitchRepository {
	constructor(private readonly db: Database) {}

	async create(request: ShiftSwitchRequest): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO shift_switch_requests (
					id, shift_id, requester_member_id, replacement_member_id, request_type,
					status, shift_title, shift_date, shift_time, requester_label,
					replacement_label, created_at, responded_at, last_reminded_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
			)
			.bind(
				request.id,
				request.shiftId,
				request.requesterMemberId,
				request.replacementMemberId,
				request.requestType,
				request.status,
				request.shiftTitle,
				request.shiftDate,
				request.shiftTime,
				request.requesterLabel,
				request.replacementLabel,
				request.createdAt,
				request.respondedAt,
				request.lastRemindedAt
			)
			.run();
	}

	async find(id: string): Promise<ShiftSwitchRequest | null> {
		const row = await this.db
			.prepare('SELECT * FROM shift_switch_requests WHERE id = ?1 LIMIT 1')
			.bind(id)
			.first<Row>();
		return row ? map(row) : null;
	}

	async listForMember(memberId: string): Promise<ShiftSwitchRequest[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM shift_switch_requests
				 WHERE requester_member_id = ?1 OR replacement_member_id = ?1
				 ORDER BY created_at DESC LIMIT 30`
			)
			.bind(memberId)
			.all<Row>();
		return result.results.map(map);
	}

	async respond(id: string, replacementId: string, status: 'accepted' | 'declined', at: string) {
		const result = await this.db
			.prepare(
				`UPDATE shift_switch_requests SET status = ?3, responded_at = ?4
				 WHERE id = ?1 AND replacement_member_id = ?2 AND status = 'pending'`
			)
			.bind(id, replacementId, status, at)
			.run();
		return result.meta.changes === 1;
	}

	async completeRelease(id: string, requesterId: string, at: string) {
		const result = await this.db
			.prepare(
				`UPDATE shift_switch_requests SET status = 'completed', responded_at = ?3
				 WHERE id = ?1 AND requester_member_id = ?2 AND status = 'pending'`
			)
			.bind(id, requesterId, at)
			.run();
		return result.meta.changes === 1;
	}

	async listDueReminders(today: string, through: string): Promise<ShiftSwitchRequest[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM shift_switch_requests
				 WHERE status = 'pending' AND request_type = 'replacement'
				   AND shift_date >= ?1 AND shift_date <= ?2
				   AND (last_reminded_at = '' OR last_reminded_at < datetime('now', '-1 day'))
				 ORDER BY shift_date ASC`
			)
			.bind(today, through)
			.all<Row>();
		return result.results.map(map);
	}

	async markReminded(id: string, at: string): Promise<void> {
		await this.db
			.prepare('UPDATE shift_switch_requests SET last_reminded_at = ?2 WHERE id = ?1')
			.bind(id, at)
			.run();
	}
}
