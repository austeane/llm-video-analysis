-- Track per-request Vertex AI usage for budgeting rules
CREATE TABLE IF NOT EXISTS billing_usage_ledger (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL,
  user_id TEXT,
  session_id TEXT,
  model TEXT NOT NULL,
  prompt_token_count INTEGER,
  candidates_token_count INTEGER,
  total_token_count INTEGER,
  cached_content_token_count INTEGER,
  input_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  output_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  youtube_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_usage_ledger_request_id_idx
  ON billing_usage_ledger (request_id);

CREATE INDEX IF NOT EXISTS billing_usage_ledger_created_at_idx
  ON billing_usage_ledger (created_at);

CREATE INDEX IF NOT EXISTS billing_usage_ledger_user_id_created_at_idx
  ON billing_usage_ledger (user_id, created_at);
