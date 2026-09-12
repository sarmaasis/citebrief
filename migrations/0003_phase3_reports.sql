-- Phase 3: report HTML key, summary, next_action on rows, engine cache

ALTER TABLE reports ADD COLUMN html_key TEXT;
ALTER TABLE reports ADD COLUMN summary TEXT;
ALTER TABLE reports ADD COLUMN agency_name TEXT;

ALTER TABLE run_rows ADD COLUMN next_action TEXT;
ALTER TABLE run_rows ADD COLUMN status TEXT DEFAULT 'complete';

CREATE TABLE IF NOT EXISTS engine_cache (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  engine TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  raw_answer TEXT NOT NULL,
  extracted_json TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS engine_cache_expires_idx ON engine_cache(expires_at);
CREATE INDEX IF NOT EXISTS engine_cache_key_idx ON engine_cache(cache_key);
