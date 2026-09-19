-- "출현" (밥약 요청 한 건). T2(질문·매칭)가 아직 없으므로 question_id는
-- FK 없이 자리만 잡아두고, title/field_id를 신청 시 임시로 직접 저장한다.
-- field_id는 T1의 fields(진로·취업/학업·수강/동아리·대외활동/...) 테이블을 쓴다
-- (도감 "타입"과 동일한 분류).
CREATE TABLE encounters (
  id TEXT PRIMARY KEY,
  question_id TEXT UNIQUE,
  junior_id TEXT NOT NULL REFERENCES users(id),
  field_id   TEXT NOT NULL REFERENCES fields(id),
  title TEXT NOT NULL,
  meet_type   TEXT NOT NULL CHECK (meet_type IN ('meal','cafe','online')),
  max_seniors INTEGER NOT NULL CHECK (max_seniors BETWEEN 1 AND 3),
  status TEXT NOT NULL CHECK (status IN
    ('wild','matched','met','caught','escaped','expired','cancelled')),
  wave INTEGER NOT NULL DEFAULT 1 CHECK (wave BETWEEN 1 AND 2),
  slot_start TEXT,
  slot_end   TEXT,
  place TEXT,
  next_wave_at  TEXT,
  review_due_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (status IN ('wild','expired','cancelled') OR slot_start IS NOT NULL),
  CHECK (slot_end IS NULL OR slot_end > slot_start),
  CHECK (status NOT IN ('met','caught','escaped') OR review_due_at IS NOT NULL)
);

CREATE INDEX idx_encounters_junior ON encounters(junior_id, status);
