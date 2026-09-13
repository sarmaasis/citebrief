-- Persist extra-run / prepaid-credit intent on the run so Dodo metering
-- and extraRuns settle after a report exists, not on enqueue.
ALTER TABLE runs ADD COLUMN extra_run INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN consume_credit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN billed_at INTEGER;
