CREATE TABLE IF NOT EXISTS event_volunteer_signups (
	source TEXT NOT NULL CHECK (source IN ('project', 'community')),
	event_id TEXT NOT NULL,
	member_id TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'Signed up',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (source, event_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_event_volunteer_signups_member
	ON event_volunteer_signups (member_id, created_at);
