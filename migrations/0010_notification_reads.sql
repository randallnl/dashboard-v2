CREATE TABLE IF NOT EXISTS notification_reads (
  member_id TEXT NOT NULL,
  notification_key TEXT NOT NULL,
  read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_member
  ON notification_reads (member_id, read_at DESC);
