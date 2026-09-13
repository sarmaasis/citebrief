-- PRD v2.2: gateway audit fields for in-app Sources drawer

ALTER TABLE run_rows ADD COLUMN gateway_request_id TEXT;
ALTER TABLE run_rows ADD COLUMN confidence TEXT;
