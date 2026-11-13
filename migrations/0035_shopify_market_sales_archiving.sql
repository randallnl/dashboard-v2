ALTER TABLE shopify_market_sales ADD COLUMN archived_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_shopify_market_sales_active_date
	ON shopify_market_sales (archived_at, sale_date DESC, id DESC);
