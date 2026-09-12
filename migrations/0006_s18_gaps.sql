-- PRD §18 remaining gaps: Slack webhook, billing depth fields

ALTER TABLE workspaces ADD COLUMN slack_webhook_url TEXT;

ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN extra_brands INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN extra_runs INTEGER NOT NULL DEFAULT 0;
