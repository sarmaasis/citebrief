-- Phase 5: member invites + webhook replay helper flag

CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  accepted_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS workspace_invites_workspace_idx ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_invites_email_idx ON workspace_invites(email);

ALTER TABLE webhook_events ADD COLUMN replayed_at INTEGER;
