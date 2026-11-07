-- Public campaign records. Submission data and giveaway eligibility are deliberately separate
-- from publication status: declining to display a story never removes a valid entry.
CREATE TABLE IF NOT EXISTS calendar_campaign_submissions (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	email TEXT NOT NULL,
	town TEXT NOT NULL DEFAULT '',
	story TEXT NOT NULL,
	image_key TEXT NOT NULL DEFAULT '',
	image_filename TEXT NOT NULL DEFAULT '',
	image_content_type TEXT NOT NULL DEFAULT '',
	public_display_consent INTEGER NOT NULL DEFAULT 0 CHECK (public_display_consent IN (0, 1)),
	calendar_publication_consent INTEGER NOT NULL DEFAULT 0 CHECK (calendar_publication_consent IN (0, 1)),
	image_edit_consent INTEGER NOT NULL DEFAULT 0 CHECK (image_edit_consent IN (0, 1)),
	rules_accepted INTEGER NOT NULL CHECK (rules_accepted IN (0, 1)),
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'not_displayed', 'disqualified')),
	disqualification_reason TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_campaign_submissions_wall
	ON calendar_campaign_submissions (status, public_display_consent, created_at DESC);

-- Exactly one entry is inserted with each accepted submission, independent of moderation.
CREATE TABLE IF NOT EXISTS calendar_campaign_giveaway_entries (
	id TEXT PRIMARY KEY,
	submission_id TEXT NOT NULL UNIQUE,
	eligible INTEGER NOT NULL DEFAULT 1 CHECK (eligible IN (0, 1)),
	disqualified_at TEXT NOT NULL DEFAULT '',
	disqualification_reason TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL,
	FOREIGN KEY (submission_id) REFERENCES calendar_campaign_submissions(id)
);

-- Append-only audit history. Application roles must never UPDATE or DELETE these rows.
CREATE TABLE IF NOT EXISTS calendar_campaign_moderation_audit (
	id TEXT PRIMARY KEY,
	submission_id TEXT NOT NULL,
	action TEXT NOT NULL,
	previous_status TEXT NOT NULL DEFAULT '',
	new_status TEXT NOT NULL DEFAULT '',
	note TEXT NOT NULL DEFAULT '',
	actor_id TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL,
	FOREIGN KEY (submission_id) REFERENCES calendar_campaign_submissions(id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_campaign_audit_submission
	ON calendar_campaign_moderation_audit (submission_id, created_at ASC);

CREATE TRIGGER IF NOT EXISTS prevent_calendar_campaign_audit_update
BEFORE UPDATE ON calendar_campaign_moderation_audit
BEGIN
	SELECT RAISE(ABORT, 'calendar campaign moderation audit is immutable');
END;

CREATE TRIGGER IF NOT EXISTS prevent_calendar_campaign_audit_delete
BEFORE DELETE ON calendar_campaign_moderation_audit
BEGIN
	SELECT RAISE(ABORT, 'calendar campaign moderation audit is immutable');
END;
