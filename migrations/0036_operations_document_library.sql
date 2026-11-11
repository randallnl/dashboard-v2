ALTER TABLE drive_documents ADD COLUMN library_root_id TEXT NOT NULL DEFAULT '1wEEDbh0PmGiPkdS6S_LfLZeIcQtOSIEm';
CREATE INDEX idx_drive_documents_library ON drive_documents (library_root_id, visibility);
