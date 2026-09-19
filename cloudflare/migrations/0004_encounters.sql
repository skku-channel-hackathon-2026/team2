-- "출현" (밥약 요청 한 건). T2(질문·매칭)가 아직 없으므로 question_id는
-- FK 없이 자리만 잡아두고, title/category_id를 신청 시 임시로 직접 저장한다.
-- T2가 들어오면 question_id에 questions(id) 참조를 연결하고 title/category_id는
-- questions 테이블 조회로 대체할 수 있다 (컬럼은 그대로 둬도 무해).
CREATE TABLE encounters (
  id TEXT PRIMARY KEY,
  question_id TEXT UNIQUE,
  junior_id   TEXT NOT NULL REFERENCES users(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
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
