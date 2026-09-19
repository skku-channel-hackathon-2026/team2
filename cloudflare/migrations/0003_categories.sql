-- 질문 카테고리. 도감 항목의 "타입"으로도 쓰인다 (dex_entries.type_category_id).
CREATE TABLE categories (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO categories (id, name) VALUES
  ('course', '수강·학사'),
  ('assignment', '과제·전공'),
  ('career', '진로·취업'),
  ('campus', '대학생활'),
  ('club', '동아리·대외활동');
