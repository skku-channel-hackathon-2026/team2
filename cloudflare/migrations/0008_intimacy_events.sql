-- 친밀도 적립 이력. dedupe_key로 같은 이벤트가 중복 적립되지 않는다.
CREATE TABLE intimacy_events (
  id TEXT PRIMARY KEY,
  senior_id TEXT NOT NULL,
  junior_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN
    ('first_catch','repeat_catch','five_star','self_answer','evolution')),
  points INTEGER NOT NULL CHECK (points > 0),
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (senior_id, junior_id) REFERENCES dex_entries(senior_id, junior_id)
);
