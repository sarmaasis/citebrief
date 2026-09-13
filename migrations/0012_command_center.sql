-- PRODUCT §18.2.1: owner-adjustable hours-saved estimate + persisted planned opportunities.

ALTER TABLE workspaces ADD COLUMN minutes_saved_per_report INTEGER NOT NULL DEFAULT 60;

CREATE TABLE opportunity_plans (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  report_id TEXT REFERENCES reports(id) ON DELETE SET NULL,
  opportunity_key TEXT NOT NULL,
  planned_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE UNIQUE INDEX opportunity_plans_workspace_brand_key_idx
  ON opportunity_plans (workspace_id, brand_id, opportunity_key);
CREATE INDEX opportunity_plans_workspace_idx ON opportunity_plans (workspace_id);
