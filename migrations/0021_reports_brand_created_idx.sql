-- Top-2 reports per brand: composite index makes ORDER BY created_at DESC LIMIT 2 an index-only scan
CREATE INDEX IF NOT EXISTS reports_brand_created_idx ON reports(brand_id, created_at DESC);
