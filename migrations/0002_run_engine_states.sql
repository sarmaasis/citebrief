-- Phase 2: persist stub engine progress on each run
ALTER TABLE runs ADD COLUMN engine_states TEXT;
