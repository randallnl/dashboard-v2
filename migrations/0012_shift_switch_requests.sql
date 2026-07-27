CREATE TABLE IF NOT EXISTS shift_switch_requests (
	id TEXT PRIMARY KEY,
	shift_id TEXT NOT NULL,
	requester_member_id TEXT NOT NULL,
	replacement_member_id TEXT NOT NULL DEFAULT '',
	request_type TEXT NOT NULL CHECK (request_type IN ('replacement', 'release')),
	status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
	shift_title TEXT NOT NULL DEFAULT '',
	shift_date TEXT NOT NULL DEFAULT '',
	shift_time TEXT NOT NULL DEFAULT '',
	requester_label TEXT NOT NULL DEFAULT '',
	replacement_label TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	responded_at TEXT NOT NULL DEFAULT '',
	last_reminded_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_shift_switch_requests_requester
	ON shift_switch_requests (requester_member_id, status, shift_date);

CREATE INDEX IF NOT EXISTS idx_shift_switch_requests_replacement
	ON shift_switch_requests (replacement_member_id, status, shift_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_switch_requests_pending_shift
	ON shift_switch_requests (shift_id)
	WHERE status = 'pending';
