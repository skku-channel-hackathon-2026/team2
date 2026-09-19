-- T2·T5 데모/테스트용 시드.
--
-- 사용법:
--   corepack pnpm exec wrangler d1 execute DB --local --file=scripts/seed-demo.sql
--
-- T5 (이미 성사된 밥약, 만남 완료 대기): 선배 senior-1(m-senior-1)로 /balls,
-- /dex 실행, 후배 junior-1(u-junior-1)로 /review 실행.
-- T2 (아직 안 잡힌 출현): 후배 junior-2(u-junior-2)가 encounter-2를 신청했고,
-- senior-1이 club 분야·겹치는 시간대를 가지고 있어 encounter_targets에
-- 이미 들어 있다. senior-1로 /출현 → 수락하면 wild.accept를 확인할 수 있다.

INSERT INTO users (id, channel_manager_id, nickname, is_senior, created_at, updated_at) VALUES
  ('senior-1', 'm-senior-1', '김선배', 1, '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z'),
  ('senior-2', 'm-senior-2', '이선배', 1, '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z');

INSERT INTO users (id, channel_user_id, nickname, created_at, updated_at) VALUES
  ('junior-1', 'u-junior-1', '코딩초보', '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z'),
  ('junior-2', 'u-junior-2', '새벽형인간', '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z');

-- 선배 프로필·분야·주간 가용 시간 (매칭 v1이 조회하는 테이블).
INSERT INTO senior_profiles (user_id, headline, weekly_limit_minutes, status, created_at, updated_at) VALUES
  ('senior-1', '백엔드 3년차', 300, 'active', '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z'),
  ('senior-2', '동아리 회장', 180, 'active', '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z');

INSERT INTO senior_fields (user_id, field_id) VALUES
  ('senior-1', 'club'),
  ('senior-2', 'club');

-- weekday 0 = 월요일 (senior_slots, matching.service 동일 기준).
INSERT INTO senior_slots (id, user_id, weekday, start_minute, end_minute) VALUES
  ('slot-1', 'senior-1', 0, 660, 900),  -- 월 11:00-15:00
  ('slot-2', 'senior-2', 0, 720, 780);  -- 월 12:00-13:00 (겹침이 짧아 매칭에서 밀림)

-- ── T5: 이미 성사되어 만남 완료를 기다리는 밥약 ──────────────────────────
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, slot_start, slot_end, place, created_at)
VALUES
  ('encounter-1', 'junior-1', 'club',
   '백엔드 동아리 vs 학회, 1학년은 뭐가 나아요?',
   'meal', 2, 'matched',
   '2026-09-22T03:00:00.000Z', '2026-09-22T04:00:00.000Z',
   '학생회관 학식', '2026-09-19T00:00:00.000Z');

INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at) VALUES
  ('ball-1', 'encounter-1', 'senior-1', 'thrown', '2026-09-19T00:05:00.000Z'),
  ('ball-2', 'encounter-1', 'senior-2', 'thrown', '2026-09-19T00:06:00.000Z');

-- ── T2: 아직 수락 전인 출현 (encounter.create가 만들 법한 상태를 직접 주입) ──
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, created_at)
VALUES
  ('encounter-2', 'junior-2', 'club',
   '동아리 첫 모임에서 뭘 준비해야 해요?',
   'cafe', 1, 'wild', '2026-09-19T01:00:00.000Z');

-- 2026-09-21은 월요일(KST) — senior_slots.weekday 0과 겹친다.
INSERT INTO encounter_windows (encounter_id, start_at, end_at) VALUES
  ('encounter-2', '2026-09-21T03:00:00.000Z', '2026-09-21T05:00:00.000Z'); -- KST 12:00-14:00

-- senior-1·senior-2 둘 다 대상으로 넣어 "두 선배가 동시에 수락해도 1명만
-- 성공"하는 선착순 시나리오를 재현할 수 있게 한다.
INSERT INTO encounter_targets (encounter_id, senior_id, wave, notified_at) VALUES
  ('encounter-2', 'senior-1', 1, '2026-09-19T01:00:05.000Z'),
  ('encounter-2', 'senior-2', 1, '2026-09-19T01:00:05.000Z');

-- ── manual-test.mjs 시나리오 3 전용: 재촉 한도 테스트가 encounter-1/2를
-- 건드리지 않도록 독립된 출현을 하나 더 둔다 ──────────────────────────
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, slot_start, slot_end, place, created_at)
VALUES
  ('encounter-3', 'junior-1', 'club',
   '동아리 면접에서 뭘 물어봐요?',
   'cafe', 1, 'matched',
   '2026-09-23T03:00:00.000Z', '2026-09-23T04:00:00.000Z',
   '학생회관 카페', '2026-09-19T00:00:00.000Z');

INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at) VALUES
  ('ball-3', 'encounter-3', 'senior-1', 'thrown', '2026-09-19T00:05:00.000Z');

-- ── T4: 공개된 지식 1건 (question.searchSimilar 테스트용) ────────────────
INSERT INTO knowledge_entries
  (id, question_title, answer_text, source, author_id, confirmed_by, field_id,
   status, pii_checked, valid_until_term, search_text, created_at, updated_at)
VALUES
  ('kno-1', '동아리 첫 모임에서 뭘 준비해야 해요?',
   '자기소개 한 줄이랑 궁금한 점 2~3개만 미리 적어가도 충분해요.',
   'senior', 'senior-1', 'senior-1', 'club', 'published', 1, '2026-2',
   '동아리 첫 모임에서 뭘 준비해야 해요? 자기소개 한 줄이랑 궁금한 점 2~3개만 미리 적어가도 충분해요.',
   '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z');
