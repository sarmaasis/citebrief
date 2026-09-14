-- High-risk email digest preference (workspace-level Friday hook).

ALTER TABLE workspaces ADD COLUMN notify_high_risks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN high_risk_last_notified_at INTEGER;
