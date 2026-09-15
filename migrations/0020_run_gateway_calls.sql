-- Durable AI Gateway call count per run (survives Worker isolate restarts).
ALTER TABLE runs ADD COLUMN gateway_calls INTEGER NOT NULL DEFAULT 0;
