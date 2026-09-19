-- 발표 시연용 고정 데이터 (스키마 변경 없음, 데이터만 넣는다).
--
-- 마이그레이션에 넣은 이유: 로컬을 새로 말아도, 운영자가 원격 D1에
-- 적용해도 발표자 계정이 항상 같은 상태로 존재해야 하기 때문이다.
-- 시연 중 업그레이드 플로우(신청 → 승인 → 코드 입력)를 라이브로 돌릴 필요가
-- 없어진다.
--
-- demo/ 의 로그인은 학번에서 caller를 만든다 — 후배 `skku-{학번}`,
-- 선배 `skku-m-{학번}`. 그래서 발표자(정기용 / 2023310855) 계정은 두 행이다:
--   presenter-junior … 후배 화면 (skku-2023310855)
--   presenter-senior … 선배 화면 (skku-m-2023310855, is_senior/is_staff)
-- 두 행이 분리돼 있어야 발표자가 "후배로 신청 → 선배로 수락 → 후배로 후기"를
-- 혼자 끝까지 시연할 수 있다 (dex_entries 는 senior_id <> junior_id 를 요구).
--
-- 아래 DELETE 는 마이그레이션으로 적용될 때는 no-op이다. 리허설로 상태가
-- 더럽혀졌을 때 이 파일만 다시 실행해 되돌리라고 남겨둔다:
--   corepack pnpm exec wrangler d1 execute DB --local \
--     --file=cloudflare/migrations/0012_presenter_seed.sql
--
-- scripts/seed-demo.sql 과는 id 공간이 겹치지 않는다.

DELETE FROM intimacy_events WHERE senior_id = 'presenter-senior';
DELETE FROM dex_entries WHERE senior_id = 'presenter-senior';
DELETE FROM knowledge_entries WHERE id LIKE 'kno-p%';
DELETE FROM reviews WHERE encounter_id LIKE 'enc-p%';
DELETE FROM balls WHERE encounter_id LIKE 'enc-p%';
DELETE FROM encounter_targets WHERE encounter_id LIKE 'enc-p%';
DELETE FROM encounter_windows WHERE encounter_id LIKE 'enc-p%';
DELETE FROM encounters WHERE id LIKE 'enc-p%';
DELETE FROM senior_slots WHERE user_id IN ('presenter-senior', 'p-senior-1');
DELETE FROM senior_fields WHERE user_id IN ('presenter-senior', 'p-senior-1');
DELETE FROM senior_profiles WHERE user_id IN ('presenter-senior', 'p-senior-1');
DELETE FROM upgrade_requests WHERE user_id LIKE 'presenter-%' OR user_id LIKE 'p-junior-%';
DELETE FROM users WHERE id LIKE 'presenter-%' OR id LIKE 'p-junior-%' OR id LIKE 'p-senior-%';

-- ── 발표자 계정 ────────────────────────────────────────────────────────
INSERT INTO users
  (id, channel_user_id, primary_user_chat_id, nickname, department, cohort_year, is_senior, created_at, updated_at)
VALUES
  ('presenter-junior', 'skku-2023310855', 'demo-chat-2023310855', '정기용',
   '소프트웨어학과', 2023, 0, '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z');

INSERT INTO users
  (id, channel_manager_id, nickname, department, cohort_year, is_senior, is_staff, created_at, updated_at)
VALUES
  ('presenter-senior', 'skku-m-2023310855', '정기용',
   '소프트웨어학과', 2023, 1, 1, '2026-09-19T00:00:00.000Z', '2026-09-19T00:00:00.000Z');

-- ── 상대역 (발표자 화면을 채우는 새내기들 / 발표자가 새내기로 만날 선배) ──
INSERT INTO users (id, channel_user_id, primary_user_chat_id, nickname, cohort_year, created_at, updated_at) VALUES
  ('p-junior-1', 'skku-2026310101', 'demo-chat-2026310101', '김민서', 2026, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
  ('p-junior-2', 'skku-2026310202', 'demo-chat-2026310202', '이도윤', 2026, '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z'),
  ('p-junior-3', 'skku-2026310303', 'demo-chat-2026310303', '박하린', 2026, '2026-09-03T00:00:00.000Z', '2026-09-03T00:00:00.000Z'),
  ('p-junior-4', 'skku-2025310404', 'demo-chat-2025310404', '최서준', 2025, '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z'),
  ('p-junior-5', 'skku-2025310505', 'demo-chat-2025310505', '한지우', 2025, '2026-08-21T00:00:00.000Z', '2026-08-21T00:00:00.000Z');

-- 도감을 채우는 후배들 (이미 잡힌 기록만 있고, 진행 중인 볼은 없다).
INSERT INTO users (id, channel_user_id, primary_user_chat_id, nickname, cohort_year, created_at, updated_at) VALUES
  ('p-junior-6', 'skku-2026310606', 'demo-chat-2026310606', '오시윤', 2026, '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z'),
  ('p-junior-7', 'skku-2025310707', 'demo-chat-2025310707', '강예린', 2025, '2026-06-02T00:00:00.000Z', '2026-06-02T00:00:00.000Z'),
  ('p-junior-8', 'skku-2025310808', 'demo-chat-2025310808', '정우진', 2025, '2026-05-18T00:00:00.000Z', '2026-05-18T00:00:00.000Z'),
  ('p-junior-9', 'skku-2026310909', 'demo-chat-2026310909', '신가온', 2026, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z'),
  ('p-junior-10', 'skku-2024311010', 'demo-chat-2024311010', '문하준', 2024, '2026-04-11T00:00:00.000Z', '2026-04-11T00:00:00.000Z');

INSERT INTO users (id, channel_manager_id, nickname, is_senior, created_at, updated_at) VALUES
  ('p-senior-1', 'skku-m-2021310111', '윤태경', 1, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');

-- ── 발표자(선배) 프로필: 분야 전체 + 매일 09:00~22:00 (KST) ──────────────
-- 시연 중 즉석에서 만든 밥약 요청이 반드시 발표자에게 매칭되도록 넓게 연다.
-- weekday 0 = 월요일, 분(minute)은 KST 기준 (senior_slots · matching.service 동일).
INSERT INTO senior_profiles
  (user_id, headline, portfolio, weekly_limit_minutes, status, availability_updated_at, created_at, updated_at)
VALUES
  ('presenter-senior', '백엔드 4년차 · 학회에서 3년 굴렀어요', NULL, 600, 'active',
   '2026-09-19T00:00:00.000Z', '2026-09-01T00:00:00.000Z', '2026-09-19T00:00:00.000Z'),
  ('p-senior-1', '프론트엔드 · 교환학생 다녀옴', NULL, 240, 'active',
   '2026-09-10T00:00:00.000Z', '2026-08-01T00:00:00.000Z', '2026-09-10T00:00:00.000Z');

INSERT INTO senior_fields (user_id, field_id) VALUES
  ('presenter-senior', 'career'),
  ('presenter-senior', 'study'),
  ('presenter-senior', 'club'),
  ('presenter-senior', 'grad'),
  ('presenter-senior', 'life'),
  ('p-senior-1', 'career'),
  ('p-senior-1', 'life');

INSERT INTO senior_slots (id, user_id, weekday, start_minute, end_minute) VALUES
  ('p-slot-0', 'presenter-senior', 0, 540, 1320),
  ('p-slot-1', 'presenter-senior', 1, 540, 1320),
  ('p-slot-2', 'presenter-senior', 2, 540, 1320),
  ('p-slot-3', 'presenter-senior', 3, 540, 1320),
  ('p-slot-4', 'presenter-senior', 4, 540, 1320),
  ('p-slot-5', 'presenter-senior', 5, 540, 1320),
  ('p-slot-6', 'presenter-senior', 6, 540, 1320),
  -- 경쟁 선배는 좁게 열어둬, 매칭 결과가 발표자 쪽으로 기울게 한다.
  ('p-slot-r1', 'p-senior-1', 0, 720, 780),
  ('p-slot-r2', 'p-senior-1', 3, 1080, 1200);

-- ── 선배 화면 ①: 지금 수락할 수 있는 출현 (/출현) ───────────────────────
-- 2026-09-21(월) KST 12:00~14:00 — p-slot-0(월 09:00~22:00)과 겹친다.
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, created_at)
VALUES
  ('enc-p4', 'p-junior-3', 'career',
   '1학년인데 지금부터 인턴 준비하는 게 맞을까요?',
   'meal', 1, 'wild', '2026-09-19T02:00:00.000Z');

INSERT INTO encounter_windows (encounter_id, start_at, end_at) VALUES
  ('enc-p4', '2026-09-21T03:00:00.000Z', '2026-09-21T05:00:00.000Z'),
  ('enc-p4', '2026-09-22T08:00:00.000Z', '2026-09-22T10:00:00.000Z');

INSERT INTO encounter_targets (encounter_id, senior_id, wave, notified_at) VALUES
  ('enc-p4', 'presenter-senior', 1, '2026-09-19T02:00:05.000Z');

-- ── 선배 화면 ②: 잡은 볼 (/포켓볼) ──────────────────────────────────────
-- enc-p2 = 약속만 잡힌 상태 → "만남 완료" 버튼 시연용.
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, slot_start, slot_end, place, created_at)
VALUES
  ('enc-p2', 'p-junior-2', 'study',
   '전공 기초 세 과목 한 학기에 같이 들어도 되나요?',
   'cafe', 1, 'matched',
   '2026-09-22T04:00:00.000Z', '2026-09-22T04:45:00.000Z', '학관 지하 카페',
   '2026-09-18T01:00:00.000Z');

INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at) VALUES
  ('bal-p2', 'enc-p2', 'presenter-senior', 'thrown', '2026-09-18T01:10:00.000Z');

-- enc-p3 = 만남은 끝났고 후기를 기다리는 상태 → "재촉하기" 시연용.
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, slot_start, slot_end, place, review_due_at, created_at)
VALUES
  ('enc-p3', 'p-junior-1', 'life',
   '자취 vs 기숙사, 2학년 때 뭐가 나아요?',
   'meal', 1, 'met',
   '2026-09-17T04:00:00.000Z', '2026-09-17T05:00:00.000Z', '인사캠 학식',
   '2026-09-24T05:00:00.000Z', '2026-09-15T00:00:00.000Z');

INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at, met_confirmed_at, reminders_sent) VALUES
  ('bal-p3', 'enc-p3', 'presenter-senior', 'wobbling', '2026-09-15T00:30:00.000Z', '2026-09-17T05:05:00.000Z', 0);

-- ── 선배 화면 ③: 이미 잡은 새내기 (/도감, /답변) ──────────────────────────
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, slot_start, slot_end, place, review_due_at, created_at)
VALUES
  ('enc-p1', 'p-junior-1', 'career',
   '백엔드로 가려면 학부 때 뭘 해둬야 해요?',
   'meal', 1, 'caught',
   '2026-09-12T04:00:00.000Z', '2026-09-12T05:00:00.000Z', '인사캠 학식',
   '2026-09-19T05:00:00.000Z', '2026-09-10T00:00:00.000Z');

INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at, met_confirmed_at, caught_at) VALUES
  ('bal-p1', 'enc-p1', 'presenter-senior', 'caught',
   '2026-09-10T01:00:00.000Z', '2026-09-12T05:10:00.000Z', '2026-09-12T09:00:00.000Z');

INSERT INTO reviews (encounter_id, junior_id, rating, review_text, self_answer, share_consent, created_at) VALUES
  ('enc-p1', 'p-junior-1', 5,
   '막연하던 진로가 정리됐어요. 뭘 먼저 해야 하는지 순서를 알려주셔서 좋았습니다.',
   '1학년은 토이 프로젝트 하나 끝까지 배포해보는 게 제일 남는대요.',
   1, '2026-09-12T09:00:00.000Z');

INSERT INTO dex_entries
  (senior_id, junior_id, type_field_id, first_caught_at, catch_count, intimacy, evolved_at, share_consent)
VALUES
  ('presenter-senior', 'p-junior-1', 'career', '2026-09-12T09:00:00.000Z', 1, 40, NULL, 1),
  ('presenter-senior', 'p-junior-4', 'study',  '2026-08-24T08:00:00.000Z', 3, 90, NULL, 1),
  ('presenter-senior', 'p-junior-5', 'club',   '2026-08-22T08:00:00.000Z', 5, 180, '2026-09-05T08:00:00.000Z', 1);

INSERT INTO intimacy_events (id, senior_id, junior_id, kind, points, dedupe_key, created_at) VALUES
  ('evt-p1', 'presenter-senior', 'p-junior-1', 'first_catch', 30, 'first_catch:enc-p1', '2026-09-12T09:00:00.000Z'),
  ('evt-p2', 'presenter-senior', 'p-junior-1', 'self_answer', 10, 'self_answer:enc-p1', '2026-09-12T09:00:00.000Z'),
  ('evt-p3', 'presenter-senior', 'p-junior-4', 'first_catch', 30, 'first_catch:p-junior-4', '2026-08-24T08:00:00.000Z'),
  ('evt-p4', 'presenter-senior', 'p-junior-4', 'repeat_catch', 20, 'repeat_catch:p-junior-4:2', '2026-08-31T08:00:00.000Z'),
  ('evt-p5', 'presenter-senior', 'p-junior-4', 'repeat_catch', 20, 'repeat_catch:p-junior-4:3', '2026-09-07T08:00:00.000Z'),
  ('evt-p6', 'presenter-senior', 'p-junior-4', 'five_star', 10, 'five_star:p-junior-4', '2026-09-07T08:30:00.000Z'),
  ('evt-p7', 'presenter-senior', 'p-junior-4', 'five_star', 10, 'five_star:p-junior-4:2', '2026-08-31T08:30:00.000Z'),
  ('evt-p8', 'presenter-senior', 'p-junior-5', 'first_catch', 30, 'first_catch:p-junior-5', '2026-08-22T08:00:00.000Z'),
  ('evt-p9', 'presenter-senior', 'p-junior-5', 'repeat_catch', 20, 'repeat_catch:p-junior-5:2', '2026-08-29T08:00:00.000Z'),
  ('evt-p10', 'presenter-senior', 'p-junior-5', 'repeat_catch', 20, 'repeat_catch:p-junior-5:3', '2026-09-01T08:00:00.000Z'),
  ('evt-p11', 'presenter-senior', 'p-junior-5', 'repeat_catch', 20, 'repeat_catch:p-junior-5:4', '2026-09-03T08:00:00.000Z'),
  ('evt-p12', 'presenter-senior', 'p-junior-5', 'evolution', 50, 'evolution:p-junior-5', '2026-09-05T08:00:00.000Z'),
  ('evt-p13', 'presenter-senior', 'p-junior-5', 'five_star', 10, 'five_star:p-junior-5', '2026-09-05T08:30:00.000Z'),
  ('evt-p14', 'presenter-senior', 'p-junior-5', 'repeat_catch', 20, 'repeat_catch:p-junior-5:5', '2026-09-08T08:00:00.000Z'),
  ('evt-p15', 'presenter-senior', 'p-junior-5', 'five_star', 10, 'five_star:p-junior-5:2', '2026-09-08T08:30:00.000Z');

-- ── 새내기 화면: 발표자가 새내기로 로그인했을 때 ────────────────────────────
-- enc-p5 = 만남이 끝나 후기를 기다리는 밥약 → /후기 를 그 자리에서 시연한다.
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, slot_start, slot_end, place, review_due_at, created_at)
VALUES
  ('enc-p5', 'presenter-junior', 'career',
   '졸업 전에 현업 경험 쌓는 가장 현실적인 방법이 뭘까요?',
   'meal', 1, 'met',
   '2026-09-18T04:00:00.000Z', '2026-09-18T05:00:00.000Z', '자연캠 학식',
   '2026-09-25T05:00:00.000Z', '2026-09-16T00:00:00.000Z');

INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at, met_confirmed_at) VALUES
  ('bal-p5', 'enc-p5', 'p-senior-1', 'wobbling',
   '2026-09-16T01:00:00.000Z', '2026-09-18T05:05:00.000Z');

-- ── 지식 1건: 발표자가 확인해 공개한 답 (question.searchSimilar 시연용) ──
INSERT INTO knowledge_entries
  (id, question_title, answer_text, source, source_encounter_id, author_id, confirmed_by, field_id,
   status, pii_checked, valid_until_term, search_text, created_at, updated_at)
VALUES
  ('kno-p1', '백엔드로 가려면 학부 때 뭘 해둬야 해요?',
   '토이 프로젝트 하나를 실제로 배포까지 해보는 게 제일 크게 남아요. 과제용 코드만 쌓는 것보다 훨씬 이야기할 거리가 많아져요.',
   'junior_self', 'enc-p1', 'p-junior-1', 'presenter-senior', 'career',
   'published', 1, '2026-2',
   '백엔드로 가려면 학부 때 뭘 해둬야 해요? 토이 프로젝트 하나를 실제로 배포까지 해보는 게 제일 크게 남아요. 과제용 코드만 쌓는 것보다 훨씬 이야기할 거리가 많아져요.',
   '2026-09-12T09:00:00.000Z', '2026-09-13T01:00:00.000Z');

-- ── 선배 화면 ④: 포켓볼을 상태별로 다 채운다 ────────────────────────────
-- 이 주(KST) 안에 들어가는 약속은 enc-p3 하나뿐이다 — weekly_limit_minutes
-- (600분)를 아껴둬야 시연 중 즉석에서 만든 요청도 발표자에게 매칭된다.

-- 예정: 다음 주 온라인 30분.
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, slot_start, slot_end, place, created_at)
VALUES
  ('enc-p6', 'p-junior-4', 'grad',
   '학부연구생 지원 메일, 어떻게 써야 답장이 올까요?',
   'online', 1, 'matched',
   '2026-09-23T05:00:00.000Z', '2026-09-23T05:30:00.000Z', '온라인(구글밋)',
   '2026-09-18T06:00:00.000Z');

INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at) VALUES
  ('bal-p6', 'enc-p6', 'presenter-senior', 'thrown', '2026-09-18T06:20:00.000Z');

-- 후기 대기 + 이미 한 번 재촉함 → 재촉 1번 남은 카드.
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, slot_start, slot_end, place, review_due_at, created_at)
VALUES
  ('enc-p7', 'p-junior-5', 'club',
   '학회 운영진 하면 학점 관리 가능해요?',
   'cafe', 1, 'met',
   '2026-09-11T04:00:00.000Z', '2026-09-11T04:45:00.000Z', '학관 지하 카페',
   '2026-09-18T05:00:00.000Z', '2026-09-09T00:00:00.000Z');

INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at, met_confirmed_at, reminders_sent) VALUES
  ('bal-p7', 'enc-p7', 'presenter-senior', 'wobbling',
   '2026-09-09T02:00:00.000Z', '2026-09-11T05:00:00.000Z', 1);

-- 잡음 + 후기 있음(공유 미동의 → 답변 탭에 "익명 후배"로 뜬다).
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, slot_start, slot_end, place, review_due_at, created_at)
VALUES
  ('enc-p8', 'p-junior-2', 'life',
   '동기들이랑 안 친해졌는데 지금이라도 방법 있나요?',
   'meal', 1, 'caught',
   '2026-09-08T04:00:00.000Z', '2026-09-08T05:00:00.000Z', '인사캠 학식',
   '2026-09-15T05:00:00.000Z', '2026-09-06T00:00:00.000Z');

INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at, met_confirmed_at, caught_at) VALUES
  ('bal-p8', 'enc-p8', 'presenter-senior', 'caught',
   '2026-09-06T01:00:00.000Z', '2026-09-08T05:10:00.000Z', '2026-09-08T10:00:00.000Z');

INSERT INTO reviews (encounter_id, junior_id, rating, review_text, self_answer, share_consent, created_at) VALUES
  ('enc-p8', 'p-junior-2', 4,
   '혼자만 늦은 줄 알았는데 아니라고 해주셔서 마음이 놓였어요. 소모임부터 들어가 볼게요.',
   NULL, 0, '2026-09-08T10:00:00.000Z');

-- 놓침: 후기 기한이 지나 볼이 튕겨 나간 기록 (도감에 안 올라간다).
INSERT INTO encounters
  (id, junior_id, field_id, title, meet_type, max_seniors, status, slot_start, slot_end, place, review_due_at, created_at)
VALUES
  ('enc-p9', 'p-junior-3', 'study',
   '재수강이 나을까요, 그냥 가는 게 나을까요?',
   'cafe', 1, 'escaped',
   '2026-09-04T04:00:00.000Z', '2026-09-04T04:45:00.000Z', '학관 지하 카페',
   '2026-09-11T05:00:00.000Z', '2026-09-02T00:00:00.000Z');

INSERT INTO balls (id, encounter_id, senior_id, status, thrown_at, met_confirmed_at, reminders_sent) VALUES
  ('bal-p9', 'enc-p9', 'presenter-senior', 'escaped',
   '2026-09-02T01:00:00.000Z', '2026-09-04T05:00:00.000Z', 2);

-- ── 선배 화면 ⑤: 도감을 분야별로 채운다 ─────────────────────────────────
-- intimacy 는 아래 intimacy_events 합계와 정확히 같게 맞춰 둔다
-- (30 first_catch · 20 repeat_catch · 10 five_star · 10 self_answer · 50 evolution).
-- 레벨 기준: 150+ = 4, 80+ = 3, 30+ = 2.
INSERT INTO dex_entries
  (senior_id, junior_id, type_field_id, first_caught_at, catch_count, intimacy, evolved_at, share_consent)
VALUES
  ('presenter-senior', 'p-junior-2',  'life',   '2026-09-08T10:00:00.000Z', 1,  40, NULL, 0),
  ('presenter-senior', 'p-junior-6',  'grad',   '2026-07-15T08:00:00.000Z', 1,  30, NULL, 1),
  ('presenter-senior', 'p-junior-7',  'life',   '2026-06-10T08:00:00.000Z', 4, 110, NULL, 1),
  ('presenter-senior', 'p-junior-8',  'career', '2026-05-25T08:00:00.000Z', 4, 160, '2026-08-30T08:00:00.000Z', 1),
  ('presenter-senior', 'p-junior-9',  'study',  '2026-08-10T08:00:00.000Z', 1,  40, NULL, 1),
  ('presenter-senior', 'p-junior-10', 'grad',   '2026-04-20T08:00:00.000Z', 2,  60, NULL, 1);

INSERT INTO intimacy_events (id, senior_id, junior_id, kind, points, dedupe_key, created_at) VALUES
  ('evt-p16', 'presenter-senior', 'p-junior-2', 'first_catch', 30, 'first_catch:enc-p8', '2026-09-08T10:00:00.000Z'),
  ('evt-p17', 'presenter-senior', 'p-junior-2', 'five_star', 10, 'five_star:enc-p8', '2026-09-08T10:00:00.000Z'),
  ('evt-p18', 'presenter-senior', 'p-junior-6', 'first_catch', 30, 'first_catch:p-junior-6', '2026-07-15T08:00:00.000Z'),
  ('evt-p19', 'presenter-senior', 'p-junior-7', 'first_catch', 30, 'first_catch:p-junior-7', '2026-06-10T08:00:00.000Z'),
  ('evt-p20', 'presenter-senior', 'p-junior-7', 'repeat_catch', 20, 'repeat_catch:p-junior-7:2', '2026-06-24T08:00:00.000Z'),
  ('evt-p21', 'presenter-senior', 'p-junior-7', 'repeat_catch', 20, 'repeat_catch:p-junior-7:3', '2026-07-08T08:00:00.000Z'),
  ('evt-p22', 'presenter-senior', 'p-junior-7', 'repeat_catch', 20, 'repeat_catch:p-junior-7:4', '2026-07-29T08:00:00.000Z'),
  ('evt-p23', 'presenter-senior', 'p-junior-7', 'five_star', 10, 'five_star:p-junior-7', '2026-07-29T08:30:00.000Z'),
  ('evt-p24', 'presenter-senior', 'p-junior-7', 'self_answer', 10, 'self_answer:p-junior-7', '2026-07-29T08:30:00.000Z'),
  ('evt-p25', 'presenter-senior', 'p-junior-8', 'first_catch', 30, 'first_catch:p-junior-8', '2026-05-25T08:00:00.000Z'),
  ('evt-p26', 'presenter-senior', 'p-junior-8', 'repeat_catch', 20, 'repeat_catch:p-junior-8:2', '2026-06-15T08:00:00.000Z'),
  ('evt-p27', 'presenter-senior', 'p-junior-8', 'repeat_catch', 20, 'repeat_catch:p-junior-8:3', '2026-07-20T08:00:00.000Z'),
  ('evt-p28', 'presenter-senior', 'p-junior-8', 'repeat_catch', 20, 'repeat_catch:p-junior-8:4', '2026-08-30T08:00:00.000Z'),
  ('evt-p29', 'presenter-senior', 'p-junior-8', 'evolution', 50, 'evolution:p-junior-8', '2026-08-30T08:00:00.000Z'),
  ('evt-p30', 'presenter-senior', 'p-junior-8', 'five_star', 10, 'five_star:p-junior-8', '2026-08-30T08:30:00.000Z'),
  ('evt-p31', 'presenter-senior', 'p-junior-8', 'self_answer', 10, 'self_answer:p-junior-8', '2026-08-30T08:30:00.000Z'),
  ('evt-p32', 'presenter-senior', 'p-junior-9', 'first_catch', 30, 'first_catch:p-junior-9', '2026-08-10T08:00:00.000Z'),
  ('evt-p33', 'presenter-senior', 'p-junior-9', 'five_star', 10, 'five_star:p-junior-9', '2026-08-10T08:30:00.000Z'),
  ('evt-p34', 'presenter-senior', 'p-junior-10', 'first_catch', 30, 'first_catch:p-junior-10', '2026-04-20T08:00:00.000Z'),
  ('evt-p35', 'presenter-senior', 'p-junior-10', 'repeat_catch', 20, 'repeat_catch:p-junior-10:2', '2026-05-11T08:00:00.000Z'),
  ('evt-p36', 'presenter-senior', 'p-junior-10', 'self_answer', 10, 'self_answer:p-junior-10', '2026-05-11T08:30:00.000Z');
