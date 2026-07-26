CREATE TABLE IF NOT EXISTS member_directory (
	id TEXT PRIMARY KEY,
	preferred_name TEXT NOT NULL DEFAULT '',
	first_name TEXT NOT NULL DEFAULT '',
	last_name TEXT NOT NULL DEFAULT '',
	membership_type TEXT NOT NULL DEFAULT '',
	email TEXT NOT NULL DEFAULT '',
	other_emails_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(other_emails_json)),
	phone TEXT NOT NULL DEFAULT '',
	business_name TEXT NOT NULL DEFAULT '',
	website TEXT NOT NULL DEFAULT '',
	social_media TEXT NOT NULL DEFAULT '',
	creative_ground_url TEXT NOT NULL DEFAULT '',
	artist_description TEXT NOT NULL DEFAULT '',
	artist_photo_url TEXT NOT NULL DEFAULT '',
	artist_banner_url TEXT NOT NULL DEFAULT '',
	sign_up_date TEXT NOT NULL DEFAULT '',
	synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_member_directory_name
	ON member_directory (first_name, last_name, preferred_name);

CREATE INDEX IF NOT EXISTS idx_member_directory_email
	ON member_directory (email);

CREATE INDEX IF NOT EXISTS idx_member_directory_membership
	ON member_directory (membership_type, preferred_name);
