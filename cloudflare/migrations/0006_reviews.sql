-- 출현당 후기 1개. 후배 본인만 제출할 수 있다 (선배 혼자서는 잡을 수 없음).
CREATE TABLE reviews (
  encounter_id TEXT PRIMARY KEY REFERENCES encounters(id),
  junior_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL CHECK (length(review_text) >= 20),
  self_answer TEXT,
  share_consent INTEGER NOT NULL DEFAULT 0 CHECK (share_consent IN (0,1)),
  created_at TEXT NOT NULL
);
