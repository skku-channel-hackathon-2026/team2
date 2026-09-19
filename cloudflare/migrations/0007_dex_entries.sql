-- 선배 도감의 한 줄 = (선배, 후배) 한 쌍.
CREATE TABLE dex_entries (
  senior_id TEXT NOT NULL REFERENCES users(id),
  junior_id TEXT NOT NULL REFERENCES users(id),
  type_category_id TEXT NOT NULL REFERENCES categories(id),
  first_caught_at TEXT NOT NULL,
  catch_count INTEGER NOT NULL DEFAULT 1 CHECK (catch_count >= 1),
  intimacy    INTEGER NOT NULL DEFAULT 0 CHECK (intimacy >= 0),
  evolved_at  TEXT,
  share_consent INTEGER NOT NULL DEFAULT 0 CHECK (share_consent IN (0,1)),
  PRIMARY KEY (senior_id, junior_id),
  CHECK (senior_id <> junior_id)
);
