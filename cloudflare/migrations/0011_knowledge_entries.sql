-- 지식 루프: 후배의 자기 답(review.submit의 selfAnswer)이 draft로 들어오고,
-- 선배 확인 + PII 검사를 거쳐 published되면 question.searchSimilar가 찾는다.
-- knowledge_fields(다대다) 대신 encounters/dex_entries와 같은 방식으로
-- field_id 1개만 둔다.
CREATE TABLE knowledge_entries (
  id TEXT PRIMARY KEY,
  question_title TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('junior_self','senior','seed')),
  source_encounter_id TEXT,
  author_id TEXT REFERENCES users(id),
  confirmed_by TEXT REFERENCES users(id),
  field_id TEXT NOT NULL REFERENCES fields(id),
  status TEXT NOT NULL CHECK (status IN ('draft','published','expired','rejected')),
  pii_checked INTEGER NOT NULL DEFAULT 0 CHECK (pii_checked IN (0,1)),
  valid_until_term TEXT,
  search_text TEXT NOT NULL,
  exported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status <> 'published' OR (pii_checked = 1 AND confirmed_by IS NOT NULL))
);

CREATE INDEX idx_knowledge_field_status ON knowledge_entries(field_id, status);
