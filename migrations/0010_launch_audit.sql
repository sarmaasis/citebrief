-- Launch audit: revocable client links + admin audit log.

ALTER TABLE reports ADD COLUMN share_revoked_at INTEGER;

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT,
  actor_user_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata TEXT,
  ip TEXT,
  created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE INDEX audit_logs_workspace_idx ON audit_logs (workspace_id);
CREATE INDEX audit_logs_action_idx ON audit_logs (action);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at);
