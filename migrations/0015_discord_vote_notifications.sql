CREATE TABLE IF NOT EXISTS discord_vote_notifications (
	vote_key TEXT PRIMARY KEY,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
	reserved_at TEXT NOT NULL DEFAULT '',
	posted_at TEXT NOT NULL DEFAULT '',
	attempts INTEGER NOT NULL DEFAULT 0,
	last_error TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discord_vote_notifications_status
	ON discord_vote_notifications(status, reserved_at);
