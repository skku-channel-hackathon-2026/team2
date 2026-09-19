-- 출현 알림을 받은 선배 (수락 자격이 있는 사람). wild.accept의 원자적
-- 수락 쿼리가 "대상자인지" 확인할 때 이 테이블을 EXISTS로 조회한다.
CREATE TABLE encounter_targets (
  encounter_id TEXT NOT NULL REFERENCES encounters(id),
  senior_id TEXT NOT NULL REFERENCES users(id),
  wave INTEGER NOT NULL DEFAULT 1 CHECK (wave BETWEEN 1 AND 2),
  notified_at TEXT NOT NULL,
  PRIMARY KEY (encounter_id, senior_id)
);

CREATE INDEX idx_encounter_targets_senior ON encounter_targets(senior_id);
