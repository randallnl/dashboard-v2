CREATE TABLE IF NOT EXISTS calendar_subscription_tokens (
  member_id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
