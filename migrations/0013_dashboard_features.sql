-- DASHBOARD_FEATURES: opportunity queue statuses + owner/effort metadata.

ALTER TABLE opportunity_plans ADD COLUMN status TEXT NOT NULL DEFAULT 'planned';
ALTER TABLE opportunity_plans ADD COLUMN owner TEXT;
ALTER TABLE opportunity_plans ADD COLUMN effort TEXT;
ALTER TABLE opportunity_plans ADD COLUMN impact TEXT;
ALTER TABLE opportunity_plans ADD COLUMN suggested_action TEXT;
ALTER TABLE opportunity_plans ADD COLUMN suggested_page TEXT;
ALTER TABLE opportunity_plans ADD COLUMN dismissed_at INTEGER;
ALTER TABLE opportunity_plans ADD COLUMN completed_at INTEGER;
ALTER TABLE opportunity_plans ADD COLUMN updated_at INTEGER;
