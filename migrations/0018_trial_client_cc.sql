-- Trial conversion: one CiteBrief-branded client CC on the first report.

ALTER TABLE subscriptions ADD COLUMN trial_client_cc_used INTEGER NOT NULL DEFAULT 0;
