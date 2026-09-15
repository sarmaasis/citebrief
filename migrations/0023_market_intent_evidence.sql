ALTER TABLE brands ADD COLUMN market text NOT NULL DEFAULT 'US';
ALTER TABLE prompts ADD COLUMN intent text NOT NULL DEFAULT 'discovery';
ALTER TABLE prompts ADD COLUMN branded integer NOT NULL DEFAULT 0;
ALTER TABLE run_rows ADD COLUMN position integer;
ALTER TABLE run_rows ADD COLUMN sentiment text;
ALTER TABLE run_rows ADD COLUMN verbatim text;

CREATE INDEX IF NOT EXISTS prompts_brand_intent_idx ON prompts (brand_id, intent);
