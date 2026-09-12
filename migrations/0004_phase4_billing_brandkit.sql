-- Phase 4: brand kit + workspace billing helpers

CREATE TABLE IF NOT EXISTS brand_kits (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  logo_url TEXT,
  accent_color TEXT NOT NULL DEFAULT '#0B3D2E',
  footer_text TEXT,
  prepared_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE workspaces ADD COLUMN sender_name TEXT;
ALTER TABLE workspaces ADD COLUMN default_engines TEXT;

ALTER TABLE subscriptions ADD COLUMN trial_ends_at INTEGER;
ALTER TABLE subscriptions ADD COLUMN brands_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN runs_used INTEGER NOT NULL DEFAULT 0;
