-- T1: junior accounts, senior upgrade flow, senior profiles.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  channel_user_id TEXT UNIQUE,
  channel_manager_id TEXT UNIQUE,
  primary_user_chat_id TEXT,
  nickname TEXT NOT NULL,
  department TEXT,
  cohort_year INTEGER,
  notify_level TEXT NOT NULL DEFAULT 'all' CHECK (notify_level IN ('all','important','none')),
  is_senior INTEGER NOT NULL DEFAULT 0 CHECK (is_senior IN (0,1)),
  is_staff INTEGER NOT NULL DEFAULT 0 CHECK (is_staff IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (channel_user_id IS NOT NULL OR channel_manager_id IS NOT NULL),
  CHECK (is_senior = 0 OR channel_manager_id IS NOT NULL)
);

CREATE TABLE upgrade_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  email TEXT,
  intro TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','approved','linked','rejected','expired')),
  code_hash TEXT,
  code_plain TEXT,
  code_expires_at TEXT,
  code_attempts INTEGER NOT NULL DEFAULT 0 CHECK (code_attempts BETWEEN 0 AND 5),
  reason TEXT,
  decided_by_manager_id TEXT,
  decided_at TEXT,
  delivered_via TEXT CHECK (delivered_via IN ('user_chat','wam_only','email','manual')),
  linked_manager_id TEXT,
  linked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status <> 'approved' OR (code_hash IS NOT NULL AND code_expires_at IS NOT NULL)),
  CHECK (status <> 'linked' OR linked_manager_id IS NOT NULL)
);

CREATE UNIQUE INDEX one_open_upgrade_per_user
  ON upgrade_requests(user_id) WHERE status IN ('requested','approved');

CREATE INDEX idx_upgrade_status ON upgrade_requests(status, created_at);

CREATE TABLE fields (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE senior_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  headline TEXT,
  portfolio TEXT,
  weekly_limit_minutes INTEGER NOT NULL DEFAULT 120 CHECK (weekly_limit_minutes >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE senior_fields (
  user_id TEXT NOT NULL REFERENCES users(id),
  field_id TEXT NOT NULL REFERENCES fields(id),
  PRIMARY KEY (user_id, field_id)
);

CREATE TABLE senior_slots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  CHECK (end_minute > start_minute)
);

CREATE INDEX idx_senior_slots_user ON senior_slots(user_id);

INSERT INTO fields (id, label, sort_order) VALUES
  ('career', '진로·취업', 1),
  ('study', '학업·수강', 2),
  ('club', '동아리·대외활동', 3),
  ('grad', '대학원·연구', 4),
  ('life', '학교생활', 5);

INSERT INTO categories (id, label, sort_order) VALUES
  ('question', '궁금해요', 1),
  ('advice', '조언이 필요해요', 2),
  ('review', '경험이 궁금해요', 3);

-- Brute-force guard for link codes: the submitted code identifies no row when
-- it is wrong, so attempts are counted against the manager submitting them.
CREATE TABLE link_attempts (
  manager_id TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL
);
