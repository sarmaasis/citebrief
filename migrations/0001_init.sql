-- CiteBrief Phase 1 schema
-- Better Auth (plural tables) + product tables from PRODUCT.md §16

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timezone TEXT,
  city TEXT,
  country TEXT,
  region TEXT,
  region_code TEXT,
  colo TEXT,
  latitude TEXT,
  longitude TEXT
);

CREATE INDEX IF NOT EXISTS sessions_userId_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS accounts_userId_idx ON accounts(user_id);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS verifications_identifier_idx ON verifications(identifier);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_idx
  ON workspace_members(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  site_url TEXT,
  logo_url TEXT,
  vertical TEXT,
  category TEXT,
  buyer TEXT,
  job TEXT,
  incumbent TEXT,
  constraint_note TEXT,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS brands_workspace_idx ON brands(workspace_id);

CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS competitors_brand_idx ON competitors(brand_id);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  mix TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS prompts_brand_idx ON prompts(brand_id);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  period_start TEXT,
  period_end TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS runs_brand_idx ON runs(brand_id);
CREATE INDEX IF NOT EXISTS runs_status_idx ON runs(status);

CREATE TABLE IF NOT EXISTS run_rows (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  engine TEXT NOT NULL,
  mentioned INTEGER,
  recommended INTEGER,
  rank_in_shortlist INTEGER,
  cited_urls TEXT,
  cited_brand_url INTEGER,
  who_won TEXT,
  others_named TEXT,
  sentence TEXT,
  raw_answer TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS run_rows_run_idx ON run_rows(run_id);
CREATE INDEX IF NOT EXISTS run_rows_prompt_engine_idx ON run_rows(prompt_id, engine);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  r2_key TEXT,
  score_mentioned INTEGER,
  score_total INTEGER NOT NULL DEFAULT 20,
  share_token TEXT UNIQUE,
  share_expires_at INTEGER,
  sent_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS reports_brand_idx ON reports(brand_id);
CREATE INDEX IF NOT EXISTS reports_run_idx ON reports(run_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dodo_customer_id TEXT,
  dodo_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'agency',
  status TEXT NOT NULL DEFAULT 'none',
  current_period_end INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_workspace_idx ON subscriptions(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_dodo_subscription_idx
  ON subscriptions(dodo_subscription_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'dodo',
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  processed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_event_id_idx ON webhook_events(event_id);
