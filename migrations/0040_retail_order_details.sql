ALTER TABLE retail_orders ADD COLUMN brand TEXT NOT NULL DEFAULT '';
ALTER TABLE retail_orders ADD COLUMN item_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE retail_orders ADD COLUMN total TEXT NOT NULL DEFAULT '';

CREATE TABLE retail_order_products (
 order_id TEXT NOT NULL REFERENCES retail_orders(id) ON DELETE CASCADE,
 position INTEGER NOT NULL,
 name TEXT NOT NULL,
 quantity INTEGER NOT NULL DEFAULT 0,
 unit_price TEXT NOT NULL DEFAULT '',
 thumbnail_url TEXT NOT NULL DEFAULT '',
 PRIMARY KEY (order_id, position)
);

CREATE INDEX idx_retail_order_products_order_id ON retail_order_products(order_id);
