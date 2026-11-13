CREATE TABLE retail_inbox (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 token TEXT NOT NULL UNIQUE
);
CREATE TABLE retail_orders (
 id TEXT PRIMARY KEY,
 dedupe_key TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL,
 order_number TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE TABLE retail_order_steps (
 order_id TEXT NOT NULL REFERENCES retail_orders(id) ON DELETE CASCADE,
 step_id TEXT NOT NULL,
 completed_at TEXT NOT NULL DEFAULT '',
 completed_by TEXT NOT NULL DEFAULT '',
 PRIMARY KEY (order_id, step_id)
);
