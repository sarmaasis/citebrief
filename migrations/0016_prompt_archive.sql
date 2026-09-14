-- Soft-archive prompts so regenerate/replace does not cascade-delete run_rows.

ALTER TABLE prompts ADD COLUMN archived_at INTEGER;

CREATE INDEX IF NOT EXISTS prompts_brand_active_idx ON prompts(brand_id, archived_at);
