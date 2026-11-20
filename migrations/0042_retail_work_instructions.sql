CREATE TABLE IF NOT EXISTS retail_work_instructions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	step_id TEXT NOT NULL,
	url TEXT NOT NULL,
	label TEXT NOT NULL DEFAULT '',
	updated_by TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE(step_id, url)
);

INSERT INTO retail_work_instructions (step_id, url, label, updated_by, updated_at)
VALUES
	('received', 'https://docs.google.com/document/d/1lXkrPBTYCMh8xEUQjfZ4I1qMcAiJqdv1c50la9YGC1E/edit', 'Retail Operations and Totally Tea Process — §2', 'system:retail-work-instructions', CURRENT_TIMESTAMP),
	('shopify', 'https://docs.google.com/document/d/1n4RDYmZmS7GxN2lyqBZAycLE2RO0FRceKLy5ueFc4cs/edit', 'Faire Inventory Processing Work Instruction', 'system:retail-work-instructions', CURRENT_TIMESTAMP),
	('totally-tea', 'https://docs.google.com/document/d/13yLjNxp9D8ySmYetWo0n7AAc1hwwZVo3seTosVwMFJg/edit', 'Adding New Queerlective Products to Totally Tea’s Square System', 'system:retail-work-instructions', CURRENT_TIMESTAMP),
	('labels', 'https://docs.google.com/document/d/1tihdY4YCkuDSLhLlWl9JJbsluqBH_8bWe1GMMxzKhlQ/edit', 'Printing Shopify Barcode Labels', 'system:retail-work-instructions', CURRENT_TIMESTAMP),
	('display', 'https://docs.google.com/document/d/1xM_CGUErFeGIKIG9nMz5-s8pQAfVZpAJzKdzc2MpVmU/edit', 'Inventory Intake Workflow for Artist Pieces — step 3', 'system:retail-work-instructions', CURRENT_TIMESTAMP),
	('display', 'https://docs.google.com/document/d/1lXkrPBTYCMh8xEUQjfZ4I1qMcAiJqdv1c50la9YGC1E/edit', 'Retail Operations and Totally Tea Process — Working Draft', 'system:retail-work-instructions', CURRENT_TIMESTAMP)
ON CONFLICT(step_id, url) DO UPDATE SET
	label = excluded.label,
	updated_by = excluded.updated_by,
	updated_at = excluded.updated_at;
