-- T5 잡기 파이프라인 데모/테스트용 시드. "이미 밥약이 성사되어 만남 완료를
-- 기다리는 상태"를 여기서 직접 만든다 (T2 매칭 로직은 아직 없음).
--
-- 사용법:
--   corepack pnpm exec wrangler d1 execute DB --local --file=scripts/seed-demo.sql
--
-- 선배 senior-1(channel_manager_id='m-senior-1')로 /balls, /dex를 실행하고,
-- 후배 junior-1(channel_user_id='u-junior-1')로 /review를 실행해 확인한다.

INSERT INTO users (id, channel_manager_id, nickname, is_senior, created_at, updated_at) VALUES
  ('senior-1', 'm-senior-1', '김선배', 1, '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z'),
  ('senior-2', 'm-senior-2', '이선배', 1, '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z');

INSERT INTO users (id, channel_user_id, nickname, created_at, updated_at) VALUES
  ('junior-1', 'u-junior-1', '코딩초보', '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z');

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
