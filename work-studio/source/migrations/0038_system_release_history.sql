-- Central system update and restore history
CREATE TABLE IF NOT EXISTS system_release_history (
  release_id INTEGER PRIMARY KEY AUTOINCREMENT,
  component TEXT NOT NULL CHECK(component IN ('core','media-engine','global-community')),
  action TEXT NOT NULL CHECK(action IN ('update','rollback')),
  from_ref TEXT,
  target_ref TEXT NOT NULL,
  workflow_run_url TEXT,
  requested_by INTEGER,
  status TEXT NOT NULL DEFAULT 'requested',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_system_release_component_created
  ON system_release_history(component, created_at DESC);
