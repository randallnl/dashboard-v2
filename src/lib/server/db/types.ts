export type MagicLoginTokenRow = {
	token_hash: string;
	email: string;
	expires_at: string;
	used_at: string;
	created_at: string;
};

export type MagicSessionRow = {
	session_hash: string;
	email: string;
	member_id: string;
	expires_at: string;
	created_at: string;
	last_seen_at: string;
};

export type ColabShiftRow = {
	id: string;
	board_id: string;
	parent_id: string;
	month: string;
	title: string;
	date_label: string;
	date_value: string;
	time_label: string;
	member_id: string;
	person: string;
	covered_by: string;
	coverage_status: string;
	is_covered: number;
	tags_json: string;
	synced_at: string;
};

export type ProjectEventRecordRow = {
	id: string;
	source: string;
	title: string;
	date_value: string;
	end_date_value: string;
	status: string;
	location: string;
	owner: string;
	admin_only: number;
	record_json: string;
	synced_at: string;
};

export type CleanupResult = {
	tokensDeleted: number;
	sessionsDeleted: number;
	rateLimitsDeleted: number;
};

export type Database = Pick<D1Database, 'prepare' | 'batch'>;
