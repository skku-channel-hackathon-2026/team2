-- T0: shared settings, cross-instance token cache, notification outbox.

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE app_tokens (
  cache_key TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  cached_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('group','user_chat')),
  target_id TEXT,
  target_user_id TEXT,
  root_message_id TEXT,
  body_json TEXT NOT NULL CHECK (json_valid(body_json)),
  urgent INTEGER NOT NULL DEFAULT 0 CHECK (urgent IN (0,1)),
  due_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  run_id TEXT,
  sent_message_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (target_type <> 'group' OR target_id IS NOT NULL),
  CHECK (target_type <> 'user_chat' OR target_user_id IS NOT NULL)
);

CREATE INDEX idx_noti_due ON notifications(status, due_at);
