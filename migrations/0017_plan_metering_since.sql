-- Mid-period plan changes start a fresh metering window so prior-plan runs
-- are not re-counted against the new plan's monthly recheck pool / softCap.

ALTER TABLE subscriptions ADD COLUMN plan_metering_since INTEGER;
