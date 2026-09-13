-- PRD engineering: client owner, recommended score, open tracking,
-- engine timestamps, custom sender domain, extra seats/credits, annual interval.

ALTER TABLE workspaces ADD COLUMN sender_domain TEXT;

ALTER TABLE brands ADD COLUMN client_owner TEXT;

ALTER TABLE run_rows ADD COLUMN engine_at INTEGER;

ALTER TABLE reports ADD COLUMN score_recommended INTEGER;
ALTER TABLE reports ADD COLUMN share_open_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reports ADD COLUMN share_last_opened_at INTEGER;

ALTER TABLE subscriptions ADD COLUMN extra_seats INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN extra_run_credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN billing_interval TEXT NOT NULL DEFAULT 'monthly';
