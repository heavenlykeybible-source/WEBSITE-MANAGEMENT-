-- Account 10: persistent and concurrency-safe Gemini usage limits.
-- Apply only after base schema and migrations 0002 through 0007.
-- A separate account scope limits aggregate Gemini costs when multiple conversations exist.
CREATE TABLE IF NOT EXISTS ai_rate_limits (
  scope TEXT NOT NULL,
  window_kind TEXT NOT NULL CHECK(window_kind IN ('minute', 'hour')),
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK(request_count >= 0),
  PRIMARY KEY (scope, window_kind, window_start)
);
CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_window ON ai_rate_limits(window_kind, window_start);
