-- 후배 Go: 사람 (후배=고객 계정 / 선배=팀원 계정). 한 행에 두 채널톡 ID가
-- 연결되면 "후배였던 사람이 선배가 됨(진화)"을 계산할 수 있다 (T5 §8.4).
-- 계정 자동 생성·연결(T1)은 아직 없으므로, 지금은 scripts/seed-demo.sql로 채운다.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  channel_user_id      TEXT UNIQUE,
  channel_manager_id   TEXT UNIQUE,
  primary_user_chat_id TEXT,
  nickname   TEXT NOT NULL,
  department TEXT,
  cohort_year INTEGER,
  notify_level TEXT NOT NULL DEFAULT 'all' CHECK (notify_level IN ('all','important','none')),
  is_senior INTEGER NOT NULL DEFAULT 0 CHECK (is_senior IN (0,1)),
  is_staff  INTEGER NOT NULL DEFAULT 0 CHECK (is_staff IN (0,1)),
  created_at TEXT NOT NULL,
  CHECK (channel_user_id IS NOT NULL OR channel_manager_id IS NOT NULL),
  CHECK (is_senior = 0 OR channel_manager_id IS NOT NULL)
);
