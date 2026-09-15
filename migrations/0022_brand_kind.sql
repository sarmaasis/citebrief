-- Sample demo brands and 48h pitch audits do not consume a client brand slot.
ALTER TABLE brands ADD COLUMN kind TEXT NOT NULL DEFAULT 'client';
ALTER TABLE brands ADD COLUMN expires_at INTEGER;
CREATE INDEX IF NOT EXISTS brands_workspace_kind_idx ON brands(workspace_id, kind);
