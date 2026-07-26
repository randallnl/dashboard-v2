CREATE TABLE IF NOT EXISTS vote_submissions (
	member_id TEXT NOT NULL,
	vote_key TEXT NOT NULL,
	response TEXT NOT NULL DEFAULT '',
	monday_item_id TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (member_id, vote_key)
);

CREATE INDEX IF NOT EXISTS idx_vote_submissions_created_at
	ON vote_submissions (created_at);
